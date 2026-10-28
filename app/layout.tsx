import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'MITOBICEL | Catálogo mayorista directo de fábrica',description:'Bolsas camiseta, arranque, residuos, Folex y film. Venta mayorista y precios actualizados. Burzaco, Buenos Aires.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es-AR"><body>{children}</body></html>}
