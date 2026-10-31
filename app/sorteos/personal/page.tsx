import type {Metadata} from 'next';
import SorteosPersonal from '@/components/SorteosPersonal';
export const metadata:Metadata={
 title:'MITOBICEL | Generador de códigos de Sorteos',
 robots:{index:false,follow:false,noarchive:true}
};
export default function Page(){return <SorteosPersonal/>;}
