import type {Metadata} from 'next';
import SorteosPublic from '@/components/SorteosPublic';
export const metadata:Metadata={
 title:'MITOBICEL | Sorteos mensuales oficiales',
 description:'Participaciones, premios confirmados, fechas y resultados de los sorteos de MITOBICEL. Sin obligación de compra.',
 robots:{index:true,follow:true}
};
export default function SorteosPage(){return <SorteosPublic/>;}
