import type {Metadata} from 'next';
import SorteosAgradecimiento from '@/components/SorteosAgradecimiento';
export const metadata:Metadata={
 title:'MITOBICEL | Gracias por elegirnos · Sorteos mensuales',
 description:'Un agradecimiento de MITOBICEL a quienes compran nuestros productos, apoyan a vendedores y comercios, y hacen crecer a muchas familias. Que Dios bendiga cada hogar.',
 alternates:{canonical:'/sorteos/agradecimiento'},
 robots:{index:true,follow:true},
};
export default function AgradecimientoPage(){return <SorteosAgradecimiento/>;}
