/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef HARPE_NVM_H
#define HARPE_NVM_H
#include "core.h"
#ifdef HC_NAMES
#define HC_RECORD_BYTES 612
uint8_t hc_named_request(hc_state *s,const uint8_t *q,uint8_t *r);
#else
#define HC_RECORD_BYTES 548
#endif
int hc_record_valid(const uint8_t *r);
void hc_record_make(uint8_t *r,const hc_state *s,uint32_t generation,uint8_t enabled);
int hc_nvm_restore(hc_state *s);
int hc_nvm_can_resume(const hc_state *s);
void hc_nvm_info(uint8_t *reply);
uint8_t hc_nvm_request(hc_state *s,const uint8_t *q,uint8_t *r,uint32_t now);
void hc_nvm_tick(uint32_t now);
void hc_nvm_copy_extra(uint32_t dest,const void *src,uint32_t bytes);
#endif
