-- Q3 Revenue Report
-- Shows revenue breakdown by month and customer segment

SELECT 
  DATE_TRUNC('month', o.order_date) as month,
  c.segment,
  COUNT(o.id) as order_count,
  SUM(o.total) as revenue,
  AVG(o.total) as avg_order_value,
  COUNT(DISTINCT o.customer_id) as unique_customers
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.order_date >= @start_date 
  AND o.order_date <= @end_date
  AND o.status NOT IN ('cancelled', 'refunded')
GROUP BY 
  DATE_TRUNC('month', o.order_date),
  c.segment
ORDER BY 
  month DESC, 
  revenue DESC;