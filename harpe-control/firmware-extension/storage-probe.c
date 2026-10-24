/* SPDX-License-Identifier: GPL-3.0-or-later */
#include <stdint.h>
static void word(uint8_t *p,uint32_t value){for(int i=0;i<4;i++)p[i]=(uint8_t)(value>>(8*i));}
// This is a read observer, not a storage backend. No caller-supplied addresses.
void hc_storage_probe(volatile uint8_t *q){
 uint8_t kind=q[1],n=q[6],r[60]={0};uint16_t token=q[2]|((uint16_t)q[3]<<8),off=q[4]|((uint16_t)q[5]<<8);
 uint32_t address=0,length=0;
 if(kind==1){address=0xd8000;length=4096;}
 else if(kind==2){address=0xd9000;length=4096;}
 else if(kind==3){address=0x200087d0;length=540;}
 else if(kind==4){address=0x20007e38;length=48;}
 r[1]=1;r[2]=kind;r[4]=(uint8_t)off;r[5]=(uint8_t)(off>>8);
 if(!address||n==0||n>48||(uint32_t)off+n>length||q[7]!=0)r[0]=3;
 else{r[3]=n;word(r+8,address+off);for(uint8_t i=0;i<n;i++)r[12+i]=*(volatile const uint8_t*)(address+off+i);}
 q[0]=0;
 ((void(*)(uint32_t,uint32_t,uint32_t,const void*,uint32_t))0x1f495u)(0x55,kind,token,r,60);
}
