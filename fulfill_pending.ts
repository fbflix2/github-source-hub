import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// 1. Get completed orders in the last 48h with items that are NOT fulfilled
const { data: missingItems } = await supabase
  .from('order_items')
  .select('id, product_id, order_id, name')
  .is('delivery_data', null) // Start with those that have null delivery_data
  .order('created_at', { ascending: false })

console.log(`Found ${missingItems?.length || 0} items with null delivery_data`)

if (missingItems) {
  for (const item of missingItems) {
    // Check if order is completed
    const { data: order } = await supabase.from('orders').select('status, code').eq('id', item.order_id).single()
    if (order?.status !== 'completed') continue

    console.log(`Fulfilling item ${item.id} for order ${order.code} (${item.name})...`)
    const { data: result, error } = await supabase.rpc('fulfill_order_item', {
      p_order_item_id: item.id,
      p_product_id: item.product_id
    })
    
    if (error) {
      console.error(`Error fulfilling ${item.id}:`, error)
    } else {
      console.log(`Fulfillment result:`, result)
    }
  }
}
