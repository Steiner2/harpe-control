/* SPDX-License-Identifier: GPL-3.0-or-later */
#include "core.h"
#define TAG 0x31584348u
static void zero(void *p,uint32_t n){uint8_t *b=p;while(n--)*b++=0;}
static void copy(void *d,const void *p,uint32_t n){uint8_t *a=d;const uint8_t *b=p;while(n--)*a++=*b++;}
static uint16_t u16(const uint8_t *p){return (uint16_t)(p[0]|((uint16_t)p[1]<<8));}
static uint32_t u32(const uint8_t *p){return (uint32_t)u16(p)|((uint32_t)u16(p+2)<<16);}
static int bit(uint8_t key,uint8_t *byte,uint8_t *mask){
 if(key>=0xe0&&key<=0xe7){*byte=0;*mask=(uint8_t)(1u<<(key-0xe0));return 1;}
 if(key>=4&&key<=0x91){*byte=(uint8_t)(1+(key>>3));*mask=(uint8_t)(1u<<(key&7));return 1;}return 0;
}
static uint32_t crc(const uint8_t *b,uint32_t n){uint32_t c=~0u;while(n--){c^=*b++;for(int j=0;j<8;j++)c=(c>>1)^((0u-(c&1u))&0xedb88320u);}return ~c;}
static int emit(hc_state *s,const uint8_t *held,hc_send send){uint8_t r[21];r[0]=4;for(int i=0;i<20;i++)r[i+1]=s->physical[i]|held[i];return send(r);}
void hc_init(hc_state *s){zero(s,sizeof(*s));s->tag=TAG;s->trigger=8;s->repeat_count=2;}
static void cancel(hc_state *s){s->running=0;s->pending=0;s->release_pending=1;s->retrying=0;}
static int validate(const hc_event *e,uint16_t n){uint8_t held[20]={0};uint32_t duration=0;
 for(uint16_t i=0;i<n;i++){uint8_t b,m;if(!bit(e[i].key,&b,&m)||e[i].down>1)return 0;if(e[i].down){if(held[b]&m)return 0;held[b]|=m;}else{if(!(held[b]&m))return 0;held[b]&=(uint8_t)~m;}duration+=e[i].delay_ms;if(duration>60000)return 0;}
 for(int i=0;i<20;i++)if(held[i])return 0;return n>0;
}
int hc_valid_events(const hc_event *e,uint16_t n){return n>0&&n<=HC_MAX_EVENTS&&validate(e,n);}
uint8_t hc_command(hc_state *s,const uint8_t q[64],uint8_t r[60],uint32_t now,hc_send send){
 (void)now;(void)send;zero(r,60);if(s->tag!=TAG)hc_init(s);uint8_t op=q[1],status=0;
 switch(op){
 case 0:r[1]='H';r[2]='C';r[3]='E';r[4]='X';r[5]=1;r[6]=HC_MAX_EVENTS;r[7]=s->configured;r[8]=s->armed;r[9]=s->running;r[10]=s->release_pending;r[11]=2;break;
 case 1:if(s->running||s->pending||s->release_pending){status=2;break;}if(u16(q+4)==0||u16(q+4)>HC_MAX_EVENTS||(q[6]!=8&&q[6]!=16)||(q[7]>3||(q[7]&&((q[7]==1&&(u16(q+8)<2||u16(q+8)>255))||u16(q+10)<10||u16(q+10)>60000)))){status=3;break;}s->armed=0;s->configured=0;s->staged_count=u16(q+4);s->received=0;s->trigger=q[6];s->mode=q[7];s->repeat_count=s->mode==1?u16(q+8):2;s->gap_ms=s->mode?u16(q+10):0;break;
 case 2:{uint16_t start=u16(q+4);uint8_t n=q[6];if(!s->staged_count||n==0||n>14||start!=s->received||(uint32_t)start+n>s->staged_count){status=3;break;}for(int i=0;i<n;i++){const uint8_t *p=q+8+i*4;s->staging[start+i]=(hc_event){p[0],p[1],u16(p+2)};}s->received+=n;break;}
 case 3:if(!s->staged_count||s->received!=s->staged_count||u32(q+4)!=crc((const uint8_t*)s->staging,s->staged_count*4)||!validate(s->staging,s->staged_count)){status=3;break;}copy(s->events,s->staging,s->staged_count*4);s->count=s->staged_count;s->staged_count=0;s->configured=1;
#ifdef HC_NAMES
 s->name_length=0;zero(s->name,48);
#endif
 break;
 case 4:if(q[4]!='H'||q[5]!='A'||q[6]!='R'||q[7]!='P'||!s->configured||s->staged_count||s->running||s->release_pending){status=3;break;}s->armed=1;break;
 case 5:if(s->mode==3){status=3;break;}if(!s->armed||!s->configured||s->running||s->pending||s->release_pending){status=2;break;}s->pending=1;break;
 case 6:s->armed=0;cancel(s);break;
 default:status=1;
 }
 r[0]=status;return 12;
}
void hc_button(hc_state *s,uint8_t buttons){
 if(s->tag!=TAG)return;uint8_t pressed=buttons&s->trigger;
 if(s->mode==3&&!pressed&&s->previous&&(s->running||s->pending))cancel(s);
 if(pressed&&!s->previous&&s->armed&&s->configured){
  if(s->mode==2&&(s->running||s->pending))cancel(s);
  else if(!s->running&&!s->pending&&!s->release_pending)s->pending=1;
 }
 s->previous=pressed;
}
int hc_keyboard(hc_state *s,const uint8_t *r,uint32_t len,hc_send send){if(len!=21||r[0]!=4)return -1;if(s->tag!=TAG)hc_init(s);copy(s->physical,r+1,20);return emit(s,s->held,send);}
void hc_tick(hc_state *s,uint32_t now,hc_send send){
 if(s->tag!=TAG)hc_init(s);
 if(s->release_pending){uint8_t empty[20]={0};if(emit(s,empty,send)==0){zero(s->held,20);s->release_pending=0;}return;}
 if(s->pending){s->pending=0;s->running=1;s->index=0;s->started=now;s->due=now;s->retrying=0;s->remaining=s->mode==1?s->repeat_count:1;}
 if(!s->running)return;
 if((uint32_t)(now-s->started)>65000u+s->gap_ms){s->armed=0;cancel(s);return;}
 if((int32_t)(now-s->due)<0)return;
 if(s->index==s->count){
  if(s->mode==0||(s->mode==1&&s->remaining<=1)||(s->mode==3&&!s->previous)){cancel(s);return;}
  if(s->mode==1)s->remaining--;
  s->index=0;s->started=now;s->due=now+s->gap_ms;return;
 }
 hc_event *e=&s->events[s->index];uint8_t next[20],b,m;copy(next,s->held,20);if(!bit(e->key,&b,&m)){s->armed=0;cancel(s);return;}
 if(e->down)next[b]|=m;else next[b]&=(uint8_t)~m;
 if(emit(s,next,send)!=0){if(!s->retrying){s->retrying=1;s->retry_started=now;}else if((uint32_t)(now-s->retry_started)>1000){s->armed=0;cancel(s);}return;}
 copy(s->held,next,20);s->retrying=0;s->index++;s->due=now+e->delay_ms;
}
