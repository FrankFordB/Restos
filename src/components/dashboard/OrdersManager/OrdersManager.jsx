import { useEffect } from 'react'
import './OrdersManager.css'
import Card from '../../ui/Card/Card'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { fetchOrdersForTenant, selectOrdersForTenant } from '../../../features/orders/ordersSlice'

export default function OrdersManager({ tenantId }) {
  const dispatch = useAppDispatch()
  const orders = useAppSelector(selectOrdersForTenant(tenantId))

  useEffect(() => {
    if (!tenantId) return
    dispatch(fetchOrdersForTenant(tenantId))
  }, [dispatch, tenantId])

  return (
    <Card title="Pedidos">
      {orders.length === 0 ? (
        <p className="muted">Aún no hay pedidos.</p>
      ) : (
        <div className="orders">
          {orders.map((o) => (
            <div key={o.id} className="orders__row">
              <div>
                <div className="orders__id">{o.id}</div>
                <div className="orders__meta">
                  <span className="orders__status">{o.status}</span>
                  <span className="orders__date">{new Date(o.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="orders__total">${Number(o.total).toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
