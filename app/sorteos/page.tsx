import type {Metadata} from 'next';
import SorteosPublic from '@/components/SorteosPublic';
export const metadata:Metadata={
 title:'MITOBICEL | Sorteos mensuales oficiales',
 description:'Sorteos MITOBICEL para buscas, papeleras y distribuidores. Gracias por crecer con nosotros. Premios, fechas, resultados y participación sin obligación de compra.',
 robots:{index:true,follow:true}
};
export default function SorteosPage(){return <SorteosPublic/>;}
