/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef HARPE_DEBOUNCE_REFERENCE_H
#define HARPE_DEBOUNCE_REFERENCE_H
#include <stdint.h>
/* Offline reference only. Not linked into the installed 064B firmware. */
typedef struct {uint32_t changed[2];uint8_t raw,output,delay[2];} hd_state;
int hd_init(hd_state *state,uint8_t left_ms,uint8_t right_ms);
uint8_t hd_filter(hd_state *state,uint8_t raw_buttons,uint32_t now_ms);
#endif
