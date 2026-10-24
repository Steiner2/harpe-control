/* SPDX-License-Identifier: GPL-3.0-or-later */
#include "core.h"
#ifdef HC_NVM
#include "nvm.h"
#endif
typedef struct {hc_state core;uint32_t initialized,ms,last,fraction,restore_pending,resume_pending;} runtime;
_Static_assert(sizeof(runtime)<=0x800,"Extension exceeds reserved runtime window");
_Static_assert(sizeof(hc_event)==4,"Wire event layout must be four bytes");
#define RT ((runtime*)0x20012000u)
#define REG32(a) (*(volatile uint32_t*)(a))
#define REG8(a) (*(volatile uint8_t*)(a))
static int wired(void){return (REG32(0x20003270u)&4u)&&REG8(0x20003501u)==1;}
static int send_key(const uint8_t *p){return ((int(*)(const void*,uint32_t))0x26675u)(p,21);}
static void init(void){if(RT->initialized==0x31585452u){
#ifdef HC_NVM
 if(RT->restore_pending&&wired()&&hc_nvm_restore(&RT->core))RT->restore_pending=0;
#endif
 return;}hc_init(&RT->core);
#ifdef HC_NVM
 RT->restore_pending=1;if(wired()&&hc_nvm_restore(&RT->core))RT->restore_pending=0;
#endif
 RT->ms=0;RT->fraction=0;if(wired())((void(*)(void))0x241bdu)();RT->last=REG32(0x20003014u);for(int i=0;i<20;i++)RT->core.physical[i]=REG8(0x2000839cu+i);RT->initialized=0x31585452u;}
// Native SysTick increments 0x20003014 at approximately 8 kHz in USB mode.
// The original 0x241BC helper enables that same timer; no new peripheral is owned.
static uint32_t clock_ms(void){uint32_t current=REG32(0x20003014u),delta=current-RT->last;RT->last=current;RT->ms+=delta>>3;uint32_t remainder=(delta&7u)+RT->fraction;RT->ms+=remainder>>3;RT->fraction=remainder&7u;return RT->ms;}

__attribute__((used,noreturn)) void hc_bootstrap(void){volatile uint8_t *p=(volatile uint8_t*)RT;for(uint32_t i=0;i<
#if defined(HC_NVM) || defined(HC_CONFIG_RECOVERY)
 0x2000u
#else
 sizeof(runtime)
#endif
 ;i++)p[i]=0;((void(*)(void))0x1c201u)();for(;;){} }
__attribute__((used)) void hc_dispatch_hook(void){
 init();uint32_t now=clock_ms();volatile uint8_t *q=(volatile uint8_t*)0x20008790u;
#ifdef HC_STORAGE_PROBE
 if(wired()&&q[0]==0x55){extern void hc_storage_probe(volatile uint8_t*);hc_storage_probe(q);}
 else
#endif
#ifdef HC_CONFIG_RECOVERY
 if(wired()&&q[0]==0x56){extern void hc_config_recovery(volatile uint8_t*);hc_config_recovery(q);}
 else
#endif
 if(wired()&&q[0]==0x53){uint8_t request[64],reply[60];for(int i=0;i<64;i++)request[i]=q[i];uint8_t len;
#ifdef HC_NVM
 // Explicit RAM/NVM edits or STOP supersede a still-pending boot restore.
 if(request[1]>=1&&request[1]<=
#ifdef HC_NAMES
 9
#else
 8
#endif
 ){RT->restore_pending=0;RT->resume_pending=0;}
#ifdef HC_NAMES
 if(request[1]==9||request[1]==10)len=hc_named_request(&RT->core,request,reply);else
#endif
 if(request[1]==7||request[1]==8)len=hc_nvm_request(&RT->core,request,reply,now);else
#endif
 len=hc_command(&RT->core,request,reply,now,send_key);
#ifdef HC_NVM
 if(request[1]==0){hc_nvm_info(reply);len=28;}
#endif
 q[0]=0;((void(*)(uint32_t,uint32_t,uint32_t,const void*,uint32_t))0x1f495u)(0x53,request[1],request[2]|((uint32_t)request[3]<<8),reply,len);}
 else ((void(*)(void))0x1d6d5u)();
 if(!wired()){
#ifdef HC_NVM
  if(RT->core.armed&&hc_nvm_can_resume(&RT->core))RT->resume_pending=1;
#endif
  RT->core.armed=0;for(int i=0;i<20;i++)RT->core.physical[i]=0;if(RT->core.running||RT->core.pending){RT->core.running=0;RT->core.pending=0;RT->core.release_pending=1;}return;}
#ifdef HC_NVM
 if(RT->resume_pending&&!RT->core.release_pending){RT->resume_pending=0;if(hc_nvm_can_resume(&RT->core)){RT->core.armed=1;RT->core.previous=RT->core.trigger;}}
#endif
 hc_tick(&RT->core,now,send_key);
#ifdef HC_NVM
 hc_nvm_tick(now);
#endif
#ifdef HC_CONFIG_RECOVERY
 extern void hc_config_tick(void);hc_config_tick();
#endif
}
__attribute__((used)) int hc_mouse_hook(const uint8_t *p,uint32_t n){
 init();if(!wired()||n!=11)return ((int(*)(const void*,uint32_t))0x26625u)(p,n);
 hc_button(&RT->core,p[4]);uint8_t report[11];for(int i=0;i<11;i++)report[i]=p[i];if(RT->core.armed&&RT->core.configured)report[4]&=(uint8_t)~RT->core.trigger;
 return ((int(*)(const void*,uint32_t))0x26625u)(report,n);
}
__attribute__((used)) int hc_keyboard_hook(const uint8_t *p,uint32_t n){init();if(!wired()||n!=21||p[0]!=4)return ((int(*)(const void*,uint32_t))0x26675u)(p,n);return hc_keyboard(&RT->core,p,n,send_key);}
void *memcpy(void *d,const void *s,unsigned n){volatile uint8_t *a=d;const volatile uint8_t *b=s;while(n--)*a++=*b++;return d;}
void *memset(void *d,int v,unsigned n){volatile uint8_t *p=d;while(n--)*p++=(uint8_t)v;return d;}
