/* SPDX-License-Identifier: GPL-3.0-or-later */
#include "debounce-filter.h"
int hd_init(hd_state *s,uint8_t left,uint8_t right){
 if(left>50||right>50)return 0;
 s->changed[0]=s->changed[1]=0;s->raw=0;s->output=0;s->delay[0]=left;s->delay[1]=right;return 1;
}
uint8_t hd_filter(hd_state *s,uint8_t raw,uint32_t now){
 for(uint8_t i=0;i<2;i++){
  uint8_t bit=(uint8_t)(1u<<i);
  if((raw^s->raw)&bit){s->raw=(uint8_t)((s->raw&~bit)|(raw&bit));s->changed[i]=now;}
  if((uint32_t)(now-s->changed[i])>=s->delay[i])s->output=(uint8_t)((s->output&~bit)|(raw&bit));
 }
 return (uint8_t)((raw&~3u)|(s->output&3u));
}
