import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import './StorefrontPage.css'
import { useAppSelector } from '../../app/hooks'
import { useAppDispatch } from '../../app/hooks'
import { fetchTenantBySlug, selectTenantBySlug } from '../../features/tenants/tenantsSlice'
import { fetchProductsForTenant, selectProductsForTenant } from '../../features/products/productsSlice'
import ThemeApplier from '../../components/theme/ThemeApplier'
import { fetchTenantTheme } from '../../features/theme/themeSlice'
import ProductCard from '../../components/storefront/ProductCard/ProductCard'
import CartPanel from '../../components/storefront/CartPanel/CartPanel'
import { createPaidOrder } from '../../features/orders/ordersSlice'

export default function StorefrontPage() {
  const { slug } = useParams()
  const dispatch = useAppDispatch()
  const tenant = useAppSelector(selectTenantBySlug(slug))
  const tenantId = tenant?.id

  const products = useAppSelector(selectProductsForTenant(tenantId || 'tenant_demo'))
  const visible = useMemo(() => products.filter((p) => p.active), [products])

  const [cart, setCart] = useState({})
  const [paid, setPaid] = useState(false)
  const [lastOrderId, setLastOrderId] = useState(null)
  const checkoutRef = useRef(null)

  const cartCount = useMemo(
    () => Object.values(cart).reduce((acc, n) => acc + (Number(n) || 0), 0),
    [cart],
  )

  const cartTotal = useMemo(() => {
    const map = new Map(visible.map((p) => [p.id, p]))
    return Object.entries(cart).reduce((acc, [productId, qty]) => {
      const p = map.get(productId)
      if (!p) return acc
      return acc + Number(p.price) * Number(qty)
    }, 0)
  }, [cart, visible])

  const cartItems = useMemo(() => {
    const map = new Map(visible.map((p) => [p.id, p]))
    return Object.entries(cart)
      .map(([productId, qty]) => {
        const product = map.get(productId)
        if (!product) return null
        const safeQty = Number(qty) || 0
        return {
          product,
          qty: safeQty,
          lineTotal: Number(product.price) * safeQty,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.lineTotal - a.lineTotal)
  }, [cart, visible])

  const orderItemsPayload = useMemo(() => {
    return cartItems.map((it) => ({
      productId: it.product.id,
      name: it.product.name,
      unitPrice: Number(it.product.price),
      qty: it.qty,
      lineTotal: it.lineTotal,
    }))
  }, [cartItems])

  const addOne = (productId) =>
    setCart((c) => {
      setPaid(false)
      return { ...c, [productId]: (c[productId] || 0) + 1 }
    })

  const removeOne = (productId) =>
    setCart((c) => {
      setPaid(false)
      const next = Math.max(0, (c[productId] || 0) - 1)
      if (next === 0) {
        const { [productId]: _removed, ...rest } = c
        return rest
      }
      return { ...c, [productId]: next }
    })

  useEffect(() => {
    if (!slug) return
    dispatch(fetchTenantBySlug(slug))
  }, [dispatch, slug])

  useEffect(() => {
    if (!tenantId) return
    dispatch(fetchProductsForTenant(tenantId))
    dispatch(fetchTenantTheme(tenantId))
  }, [dispatch, tenantId])

  if (!tenant) {
    return (
      <div className="store">
        <h1>Tienda no encontrada</h1>
        <p className="muted">No existe un restaurante con ese slug.</p>
      </div>
    )
  }

  return (
    <div className="store">
      <ThemeApplier tenantId={tenantId} />
      <header className="store__header">
        <div>
          <h1 className="store__title">{tenant.name}</h1>
          <p className="muted">Menú público</p>
        </div>

        <div className="store__summaryPill" aria-label="Resumen carrito">
          <div className="store__summaryTop">{cartCount} item{cartCount === 1 ? '' : 's'}</div>
          <div className="store__summaryBottom">${cartTotal.toFixed(2)}</div>
        </div>
      </header>

      <div className="store__layout">
        <section className="store__products" aria-label="Productos">
          <div className="store__grid">
            {visible.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                quantity={cart[p.id] || 0}
                onAdd={() => addOne(p.id)}
                onRemove={() => removeOne(p.id)}
              />
            ))}
          </div>
        </section>

        <CartPanel
          items={cartItems}
          total={cartTotal}
          onAdd={addOne}
          onRemove={removeOne}
          onClear={() => {
            setPaid(false)
            setCart({})
          }}
          onCheckout={() => checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />
      </div>

      {visible.length === 0 ? <p className="muted">No hay productos activos.</p> : null}

      <section className="checkout" ref={checkoutRef} aria-label="Checkout">
        <h2 className="checkout__title">Pagar</h2>
        <p className="muted">Esto es una simulación (sin pasarela de pago). Sirve para probar el flujo.</p>

        <div className="checkout__box">
          <div className="checkout__row">
            <span>Items</span>
            <strong>{cartCount}</strong>
          </div>
          <div className="checkout__row">
            <span>Total</span>
            <strong>${cartTotal.toFixed(2)}</strong>
          </div>

          <button
            className="checkout__payBtn"
            type="button"
            disabled={cartCount === 0}
            onClick={async () => {
              if (cartCount === 0) return
              setPaid(false)
              setLastOrderId(null)

              try {
                const res = await dispatch(
                  createPaidOrder({
                    tenantId,
                    items: orderItemsPayload,
                    total: cartTotal,
                    customer: null,
                  }),
                ).unwrap()

                setPaid(true)
                setLastOrderId(res?.order?.id || null)
                setCart({})
              } catch {
                // fallback: keep cart
              }
            }}
          >
            Pagar
          </button>

          {paid ? (
            <div className="checkout__success">
              Pago registrado. Pedido creado{lastOrderId ? `: ${lastOrderId}` : ''}.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
