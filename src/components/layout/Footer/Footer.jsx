import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <span>© {new Date().getFullYear()} Resto Proyect</span>
        <span className="footer__muted">Panel para restaurantes y venta de comida</span>
      </div>
    </footer>
  )
}
