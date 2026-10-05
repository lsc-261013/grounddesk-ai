import type { Locale, PublicOrder } from '@grounddesk/shared'

const STATUS_LABELS = {
  'zh-CN': {
    pending: '待处理',
    processing: '备货中',
    shipped: '已发货',
    in_transit: '运输中',
    delivered: '已签收',
    cancelled: '已取消',
  },
  'en-US': {
    pending: 'Pending',
    processing: 'Processing',
    shipped: 'Shipped',
    in_transit: 'In transit',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  },
} as const

export const presentVerifiedOrder = (order: PublicOrder, locale: Locale): string => {
  const status = STATUS_LABELS[locale][order.status]
  const products = order.items.map((item) => `${item.model} × ${item.quantity}`).join(' · ')
  const date = order.deliveredAt?.slice(0, 10)
  return locale === 'zh-CN'
    ? `订单号与下单邮箱已匹配。订单 **${order.orderNumber}** 当前为 **${status}**。\n\n- 商品：${products}\n${date ? `- 签收日期：${date}\n` : ''}${order.carrier ? `- 承运商：${order.carrier}\n` : ''}\n这是只读查询，没有修改订单。`
    : `The order number and checkout email match. Order **${order.orderNumber}** is **${status}**.\n\n- Items: ${products}\n${date ? `- Delivered on: ${date}\n` : ''}${order.carrier ? `- Carrier: ${order.carrier}\n` : ''}\nThis is a read-only lookup. No order was changed.`
}
