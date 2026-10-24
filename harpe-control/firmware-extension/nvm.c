/* SPDX-License-Identifier: GPL-3.0-or-later */
#include "nvm.h"
// One read-only-in-place record per native snapshot. All physical writes use
// the existing firmware's flash API, inside its existing snapshot transaction.
#define SLOT 0xd1cu
#define EXTRA 0xf80u
#define COPY_BYTES 724u
#define MAGIC 0x324e4348u
#define COMMIT 0x54494d43u
#define TAG 0x534e4348u
#define U32(a) (*(volatile uint32_t*)(a))
typedef struct {
 uint32_t tag,phase,started,dest,used,error,result,source,aux_crc;
 uint8_t cache[HC_RECORD_BYTES],desired[HC_RECORD_BYTES];
#ifdef HC_NAMES
 uint8_t view[HC_RECORD_BYTES];
#endif
 uint32_t pool[4][COPY_BYTES/4];
} hc_store;
#define ST ((hc_store*)0x20012800u)
_Static_assert(sizeof(hc_store)<=0x1800,"NVM state exceeds reserved RAM");
static void copy(void *d,const void *s,uint32_t n){uint8_t *a=d;const uint8_t *b=s;while(n--)*a++=*b++;}
static void fill(void *d,uint8_t v,uint32_t n){uint8_t *p=d;while(n--)*p++=v;}
static uint16_t u16(const uint8_t *p){return p[0]|((uint16_t)p[1]<<8);}
static uint32_t u32(const uint8_t *p){return u16(p)|((uint32_t)u16(p+2)<<16);}
static void word(uint8_t *p,uint32_t v){for(int i=0;i<4;i++)p[i]=(uint8_t)(v>>(8*i));}
static uint32_t crc(const uint8_t *p,uint32_t n){uint32_t c=~0u;while(n--){c^=*p++;for(int i=0;i<8;i++)c=(c>>1)^((0u-(c&1u))&0xedb88320u);}return ~c;}
static uint32_t header_crc(const uint8_t *r){
 if(r[4]==2)return crc(r,20);
 uint8_t header[28];copy(header,r,20);copy(header+20,r+24,8);return crc(header,28);
}
#ifdef HC_NAMES
static int name_valid(const uint8_t *p,uint8_t n){
 if(n>48)return 0;
 for(uint32_t i=0;i<n;){uint32_t c=p[i++],need=0,min=0;
  if(c<0x80){if(c<32||c==127)return 0;continue;}
  if(c>=0xc2&&c<=0xdf){c&=31;need=1;min=0x80;}
  else if(c>=0xe0&&c<=0xef){c&=15;need=2;min=0x800;}
  else if(c>=0xf0&&c<=0xf4){c&=7;need=3;min=0x10000;}else return 0;
  if(i+need>n)return 0;while(need--){uint8_t b=p[i++];if((b&0xc0)!=0x80)return 0;c=(c<<6)|(b&63);}
  if(c<min||c>0x10ffff||(c>=0xd800&&c<=0xdfff)||(c>=0x80&&c<=0x9f))return 0;
 }return 1;
}
#endif
int hc_record_valid(const uint8_t *r){
 if(u32(r)!=MAGIC||(r[4]!=2&&r[4]!=3)||r[5]>1||(r[4]==2?r[7]!=0:r[7]>3)||u32(r+544)!=COMMIT||u32(r+20)!=header_crc(r))return 0;
 uint16_t n=u16(r+12);if(n>HC_MAX_EVENTS||u16(r+14)!=n*4||u32(r+16)!=crc(r+32,n*4))return 0;
 if(r[4]==2){for(int i=24;i<32;i++)if(r[i]!=255)return 0;}
 else {if(!n||!r[7]||(r[7]==1&&(u16(r+24)<2||u16(r+24)>255))||(r[7]&&(u16(r+26)<10||u16(r+26)>60000)))return 0;for(int i=28;i<32;i++)if(r[i]!=255)return 0;}
 for(uint32_t i=32+n*4;i<544;i++)if(r[i]!=255)return 0;
#ifdef HC_NAMES
 if(u32(r+548)==0x314d414eu){if(u32(r+604)!=u32(r+20)||u32(r+548)!=0x314d414eu||!r[552]||!name_valid(r+553,r[552])||u32(r+608)!=crc(r+548,60))return 0;for(uint32_t i=553+r[552];i<604;i++)if(r[i]!=255)return 0;}
#endif
 if(!n)return r[5]==0&&r[6]==0;
 return (r[6]==8||r[6]==16)&&hc_valid_events((const hc_event*)(r+32),n);
}
void hc_record_make(uint8_t *r,const hc_state *s,uint32_t generation,uint8_t enabled){
 fill(r,255,HC_RECORD_BYTES);word(r,MAGIC);r[4]=2;r[5]=s?enabled:0;r[6]=s?s->trigger:0;r[7]=0;word(r+8,generation);
 uint16_t n=s?s->count:0;r[12]=(uint8_t)n;r[13]=(uint8_t)(n>>8);r[14]=(uint8_t)(n*4);r[15]=(uint8_t)((n*4)>>8);
 if(s)copy(r+32,s->events,n*4);word(r+16,crc(r+32,n*4));if(s&&s->mode){r[4]=3;r[7]=s->mode;r[24]=(uint8_t)s->repeat_count;r[25]=(uint8_t)(s->repeat_count>>8);r[26]=(uint8_t)s->gap_ms;r[27]=(uint8_t)(s->gap_ms>>8);}
#ifdef HC_NAMES
 if(s&&s->name_length&&name_valid(s->name,s->name_length)){word(r+548,0x314d414eu);r[552]=s->name_length;copy(r+553,s->name,s->name_length);word(r+604,header_crc(r));word(r+608,crc(r+548,60));}
#endif
 word(r+20,header_crc(r));word(r+544,COMMIT);
}
static uint32_t active(void){uint32_t slot=U32(0x20007e38u);return slot==1?0xd8000u:slot==2?0xd9000u:0;}
static int busy(void){
 uint32_t api=U32(0x2000391cu);if(api!=0x3b0b8u&&api!=0x3b14cu)return 1;
 uint32_t fn=U32(api+28);return ((int(*)(void*))fn)((void*)0x2000391cu);
}
static void init(uint32_t old){
 if(ST->tag==TAG&&ST->source)return;
 if(ST->tag!=TAG){fill(ST,0,sizeof(*ST));fill(ST->cache,255,HC_RECORD_BYTES);}
 if(old&&hc_record_valid((const uint8_t*)(old+SLOT)))copy(ST->cache,(const void*)(old+SLOT),HC_RECORD_BYTES);
 ST->source=old;ST->tag=TAG;
}
int hc_nvm_restore(hc_state *s){
 uint32_t page=active();if(!page)return 0;
 init(page);if(!hc_record_valid(ST->cache)||!u16(ST->cache+12))return 1;
 s->count=u16(ST->cache+12);copy(s->events,ST->cache+32,s->count*4);s->configured=1;s->trigger=ST->cache[6];s->armed=ST->cache[5];s->previous=s->trigger;if(ST->cache[4]>=3){s->mode=ST->cache[7];s->repeat_count=u16(ST->cache+24);s->gap_ms=u16(ST->cache+26);}
#ifdef HC_NAMES
 s->name_length=u32(ST->cache+548)==0x314d414eu?ST->cache[552]:0;fill(s->name,0,48);if(s->name_length)copy(s->name,ST->cache+553,s->name_length);
#endif
 return 1;
}
int hc_nvm_can_resume(const hc_state *s){
 uint32_t page=active();if(!page||!s->configured||s->staged_count||ST->phase)return 0;
 const uint8_t *r=(const uint8_t*)(page+SLOT);
 if(!hc_record_valid(r)||!r[5]||u16(r+12)!=s->count||r[6]!=s->trigger)return 0;
#ifdef HC_NAMES
 if(u32(r+548)==0x314d414eu){if(r[552]!=s->name_length)return 0;for(uint32_t i=0;i<s->name_length;i++)if(r[553+i]!=s->name[i])return 0;}
#endif
 if(r[4]==2){if(s->mode)return 0;}
 else if(r[7]!=s->mode||u16(r+24)!=s->repeat_count||u16(r+26)!=s->gap_ms)return 0;
 for(uint32_t i=0;i<s->count*4u;i++)if(r[32+i]!=((const uint8_t*)s->events)[i])return 0;
 return 1;
}
void hc_nvm_info(uint8_t *r){
 init(active());uint32_t page=active();const uint8_t *record=(const uint8_t*)(page+SLOT);int valid=page&&hc_record_valid(record);
 r[11]=3;
#ifdef HC_NAMES
 r[11]|=4;
#endif
 r[12]=valid&&u16(record+12)!=0;r[13]=ST->phase!=0;r[14]=(uint8_t)ST->result;r[15]=r[12]?record[5]:0;word(r+16,hc_record_valid(ST->cache)?u32(ST->cache+8):0);
 word(r+20,valid?u32(record+16):0);r[24]=valid?record[12]:0;r[25]=valid?record[13]:0;r[26]=(uint8_t)busy();
}
#ifdef HC_NAMES
uint8_t hc_named_request(hc_state *s,const uint8_t *q,uint8_t *r){
 fill(r,0,60);
 if(q[1]==9){uint8_t n=q[4];if(!s->configured||s->armed||s->running||s->staged_count||s->release_pending||ST->phase||!n||!name_valid(q+5,n)){r[0]=3;return 16;}s->name_length=n;fill(s->name,0,48);copy(s->name,q+5,n);return 16;}
 uint16_t off=u16(q+4);uint8_t n=q[6];
 if(!s->configured||s->staged_count||!n||n>48||(uint32_t)off+n>HC_RECORD_BYTES){r[0]=3;return 16;}
 hc_record_make(ST->view,s,0,s->armed);r[1]=1;r[2]=(uint8_t)off;r[3]=(uint8_t)(off>>8);r[4]=n;copy(r+12,ST->view+off,n);return 60;
}
#endif
uint8_t hc_nvm_request(hc_state *s,const uint8_t *q,uint8_t *r,uint32_t now){
 init(active());fill(r,0,60);
 if(q[4]!='N'||q[5]!='V'||q[6]!='M'||q[7]!=(q[1]==7?'S':'C')||q[8]>1){r[0]=3;return 20;}
 if(ST->phase||s->running||s->pending||s->release_pending){r[0]=2;return 20;}
 if(!active()||(q[1]==7&&(!s->configured||!hc_valid_events(s->events,s->count)))){r[0]=3;return 20;}
 uint32_t gen=hc_record_valid(ST->cache)?u32(ST->cache+8)+1:1;
 hc_record_make(ST->desired,q[1]==7?s:0,gen,q[8]);
 s->armed=0;ST->phase=1;ST->started=now;ST->error=0;ST->result=1;return 20;
}
// Replaces only the native BL at 0x2230C (the 112-byte auxiliary snapshot).
// Combining the gap and those 112 bytes keeps the native queue operation count.
__attribute__((used)) void hc_nvm_copy_extra(uint32_t dest,const void *src,uint32_t n){
 if((dest!=0xd8f80u&&dest!=0xd9f80u)||n!=112){((void(*)(uint32_t,const void*,uint32_t))0x23bcdu)(dest,src,n);return;}
 uint32_t page=dest-EXTRA;init(page==0xd8000u?0xd9000u:0xd8000u);
 const uint8_t *record=ST->phase==2?ST->desired:ST->cache;
 if(!hc_record_valid(record)){((void(*)(uint32_t,const void*,uint32_t))0x23bcdu)(dest,src,n);return;}
 if(!busy())ST->used=0;
 uint32_t index;for(index=0;index<4;index++)if(!(ST->used&(1u<<index)))break;
 if(index==4){ST->error=1;ST->result=2;((void(*)(uint32_t,const void*,uint32_t))0x23bcdu)(dest,src,n);return;}
 ST->used|=1u<<index;uint8_t *buffer=(uint8_t*)ST->pool[index];fill(buffer,255,COPY_BYTES);copy(buffer,record,HC_RECORD_BYTES);copy(buffer+EXTRA-SLOT,src,112);
 uint32_t status=((uint32_t(*)(void*,uint32_t,const void*,uint32_t,void*))0x308ddu)((void*)0x2000391cu,page+SLOT,buffer,COPY_BYTES,0);
 if(status){ST->used&=~(1u<<index);ST->error=1;ST->result=2;((void(*)(uint32_t,const void*,uint32_t))0x23bcdu)(dest,src,n);}
 else if(ST->phase==2){ST->dest=page;ST->aux_crc=crc(src,112);}
}
void hc_nvm_tick(uint32_t now){
 init(active());int pending=busy();if(!pending)ST->used=0;
 if(!ST->phase)return;
 if((uint32_t)(now-ST->started)>15000){ST->phase=0;ST->result=2;return;}
 if(pending)return;
 if(ST->phase==1){ST->phase=2;ST->dest=0;((void(*)(void*))0x226e5u)((void*)0x200087d0u);return;}
 int ok=!ST->error&&ST->dest&&ST->dest==active()&&hc_record_valid((const uint8_t*)(ST->dest+SLOT));
 if(ok)for(uint32_t i=0;i<HC_RECORD_BYTES;i++)if(*(const uint8_t*)(ST->dest+SLOT+i)!=ST->desired[i]){ok=0;break;}
 if(ok&&crc((const uint8_t*)(ST->dest+EXTRA),112)!=ST->aux_crc)ok=0;
 if(ok)copy(ST->cache,ST->desired,HC_RECORD_BYTES);
 ST->phase=0;ST->result=ok?0:2;
}
