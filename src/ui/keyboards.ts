import { InlineKeyboard } from 'grammy';
import type { BotContext } from '../context.js';
import { encode, type Route } from './callback.js';

/** Кнопка с callback_data, собранным через encode. */
export function routeButton(label: string, route: Route): { text: string; callback_data: string } {
  return { text: label, callback_data: encode(route) };
}

/** Клавиатура из одной кнопки «Главное меню». */
export function mainMenuKeyboard(ctx: BotContext): InlineKeyboard {
  return new InlineKeyboard().add(routeButton(ctx.t('btn-main-menu'), { kind: 'menu' }));
}

/** Ряд «Назад» и «Главное меню» для экранов разделов. */
export function backAndMenuKeyboard(ctx: BotContext, back: Route): InlineKeyboard {
  return new InlineKeyboard()
    .add(routeButton(ctx.t('btn-back'), back))
    .row()
    .add(routeButton(ctx.t('btn-main-menu'), { kind: 'menu' }));
}
