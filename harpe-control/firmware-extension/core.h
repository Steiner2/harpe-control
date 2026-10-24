/* SPDX-License-Identifier: GPL-3.0-or-later */
#ifndef HARPE_CORE_H
#define HARPE_CORE_H
#include <stdint.h>
#define HC_MAX_EVENTS 128
#define HC_KEYS 20
typedef struct { uint8_t key, down; uint16_t delay_ms; } hc_event;
typedef struct {
 uint32_t tag, due, started, retry_started;
 uint16_t count, staged_count, received, index;
 uint8_t configured, armed, running, trigger, previous, pending, release_pending, retrying;
 uint8_t held[HC_KEYS], physical[HC_KEYS];
 hc_event events[HC_MAX_EVENTS], staging[HC_MAX_EVENTS];
 uint16_t repeat_count, gap_ms, remaining;
 uint8_t mode;
#ifdef HC_NAMES
 uint8_t name_length,name[48];
#endif
} hc_state;
typedef int (*hc_send)(const uint8_t report[21]);
void hc_init(hc_state *s);
int hc_valid_events(const hc_event *events,uint16_t count);
uint8_t hc_command(hc_state *s,const uint8_t request[64],uint8_t reply[60],uint32_t now,hc_send send);
void hc_button(hc_state *s,uint8_t buttons);
void hc_tick(hc_state *s,uint32_t now,hc_send send);
int hc_keyboard(hc_state *s,const uint8_t *report,uint32_t len,hc_send send);
#endif
