ENTRY(hc_bootstrap)
MEMORY { CODE(rx) : ORIGIN = 0x40000, LENGTH = 0x3000 }
SECTIONS {
 .text : { *(.text*) *(.rodata*) } > CODE
 .ARM.exidx : { *(.ARM.exidx*) } > CODE
 .data : { *(.data*) } > CODE
 .bss : { *(.bss*) *(COMMON) } > CODE
 ASSERT(SIZEOF(.data)==0, "Initialized RAM sections are not supported")
 ASSERT(SIZEOF(.bss)==0, "Use explicitly reserved extension runtime")
}
