import type {Metadata} from 'next';
import FullCatalogAdmin from '@/components/FullCatalogAdmin';

export const metadata:Metadata={
 title:'MITOBICEL | Superadmin · Catálogo 2',
 robots:{index:false,follow:false,noarchive:true}
};

export default function FullCatalogAdminPage(){return <FullCatalogAdmin/>;}
