"""Patch an owner-supplied exact application; no device or network access."""
from pathlib import Path
import argparse,struct,hashlib,json,subprocess,shutil,os
from elftools.elf.elffile import ELFFile
from capstone import Cs,CS_ARCH_ARM,CS_MODE_THUMB
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--original',type=Path,required=True)
parser.add_argument('--zig',type=Path)
parser.add_argument('--output',type=Path)
args=parser.parse_args();root=Path(__file__).resolve().parent
original=args.original.read_bytes();stock='ada09d08c91fdeed6f4758e78955143884b0fca1ceeadac120847852a4075c41'
if len(original)!=204800 or hashlib.sha256(original).hexdigest()!=stock:raise SystemExit('Exact owned stock application required; no output created.')
zig=args.zig or shutil.which('zig')
if not zig:
 try:
  import ziglang
  zig=Path(ziglang.__file__).parent/('zig.exe' if os.name=='nt' else 'zig')
 except ImportError:raise SystemExit('Install Zig0.14.1 or pass --zig.')
build=(args.output or root/'build-named-macros').resolve();build.mkdir(parents=True,exist_ok=True);elf=build/'extension.elf'
command=[str(zig),'cc','-target','thumb-freestanding-eabi','-mcpu=cortex_m4','-mfloat-abi=soft','-Oz','-g','-ffreestanding','-fno-builtin','-fno-stack-protector','-fno-unwind-tables','-fno-asynchronous-unwind-tables','-nostdlib','-Wl,--script='+str(root/'extension.ld'),'-Wl,--entry=hc_bootstrap','-Wl,--build-id=none','-Wl,--no-undefined',str(root/'core.c'),str(root/'adapter.c'),'-DHC_NAMES','-DHC_NVM','-DHC_STORAGE_PROBE',str(root/'nvm.c'),str(root/'storage-probe.c'),'-o',str(elf)]
subprocess.run(command,check=True,env=dict(os.environ,ZIG_GLOBAL_CACHE_DIR=str(build/'zig-cache'),ZIG_LOCAL_CACHE_DIR=str(build/'zig-local')))
image=bytearray(original);base=0x1c000
with elf.open('rb') as handle:
 binary=ELFFile(handle);symbols={s.name:s.entry.st_value for s in binary.get_section_by_name('.symtab').iter_symbols()}
 for seg in binary.iter_segments():
  if seg['p_type']!='PT_LOAD' or not seg['p_filesz']:continue
  addr=seg['p_paddr'];data=seg.data()
  if not 0x40000<=addr or addr+len(data)>0x43000 or any(original[addr-base:addr-base+len(data)]):raise SystemExit('Extension exceeds verified empty code window.')
  image[addr-base:addr-base+len(data)]=data
md=Cs(CS_ARCH_ARM,CS_MODE_THUMB)
def bl(address,target):
 delta=(target&~1)-(address+4)
 if delta&1 or not -(1<<24)<=delta<(1<<24):raise ValueError('BL range')
 u=delta&0x1ffffff;s=(u>>24)&1;i1=(u>>23)&1;i2=(u>>22)&1
 return struct.pack('<HH',0xf000|(s<<10)|((u>>12)&1023),0xd000|((1^(i1^s))<<13)|((1^(i2^s))<<11)|((u>>1)&2047))
patches=[]
for address,old_target,name in [(0x26410,0x1d6d4,'hc_dispatch_hook'),(0x233f8,0x26624,'hc_mouse_hook'),(0x21f34,0x26674,'hc_keyboard_hook'),(0x2230c,0x23bcc,'hc_nvm_copy_extra')]:
 before=bytes(image[address-base:address-base+4]);old=next(md.disasm(before,address))
 if old.mnemonic!='bl' or old.op_str!=f'#{hex(old_target)}':raise SystemExit('Original call anchor mismatch')
 after=bl(address,symbols[name]);decoded=next(md.disasm(after,address))
 if decoded.mnemonic!='bl' or decoded.op_str!=f'#{hex(symbols[name]&~1)}':raise SystemExit('New call anchor mismatch')
 image[address-base:address-base+4]=after;patches.append({'address':hex(address),'original':before.hex(),'replacement':after.hex(),'symbol':name})
if struct.unpack_from('<I',original,0x1c4c8-base)[0]!=0x1c201:raise SystemExit('Bootstrap anchor mismatch')
struct.pack_into('<I',image,0x1c4c8-base,symbols['hc_bootstrap']|1)
checksum=sum(struct.unpack('<'+'I'*(len(image)//4-1),image[:-4]))&0xffffffff;struct.pack_into('<I',image,len(image)-4,checksum)
target=build/'HCEX1-NVM-NOT-HARDWARE-VALIDATED.bin';target.write_bytes(image);digest=hashlib.sha256(image).hexdigest().upper()
manifest={'status':'Owner-supplied local build; no installation performed','candidate_sha256':digest,'original_sha256':stock.upper(),'bytes':len(image),'call_patches':patches,'name_utf8_bytes':48,'slots':1,'code_window':['0x40000','0x43000'],'runtime_window':['0x20012000','0x20014000'],'manufacturer_binary_not_redistributable_by_this_license':True}
(build/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8');print(json.dumps(manifest,indent=2))
