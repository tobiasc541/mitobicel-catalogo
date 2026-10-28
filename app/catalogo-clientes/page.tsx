import type {Metadata} from 'next';
import FullCatalog from '@/components/FullCatalog';

export const metadata:Metadata={
 title:'MITOBICEL | Catálogo completo para clientes mayoristas',
 description:'Catálogo completo y precios mayoristas MITOBICEL. Pedidos y consultas por WhatsApp.',
 robots:{index:false,follow:false}
};

export default function FullCatalogPage(){return <FullCatalog/>;}
