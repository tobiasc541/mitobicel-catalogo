import type {Metadata} from 'next';
import SorteosAdmin from '@/components/SorteosAdmin';
export const metadata:Metadata={title:'MITOBICEL | Centro de Sorteos',robots:{index:false,follow:false,noarchive:true}};
export default function SorteosAdminPage(){return <SorteosAdmin/>;}
