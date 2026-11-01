import type {Metadata} from 'next';
import SorteosCompradoresAdmin from '@/components/SorteosCompradoresAdmin';
export const metadata:Metadata={title:'MITOBICEL | Sorteos Consumidor Final · Administración',robots:{index:false,follow:false,noarchive:true}};
export default function Page(){return <SorteosCompradoresAdmin/>;}
