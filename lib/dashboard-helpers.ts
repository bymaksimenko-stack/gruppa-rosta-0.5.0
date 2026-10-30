import { pointSchema, trackingSchema, type GrowthState } from './growth-state';
export type Metric=GrowthState['tracking']['metrics'][number];
export function monthlyPoints(metric:Metric){const map=new Map<string,Metric['points'][number]>();[...metric.points].sort((a,b)=>a.date.localeCompare(b.date)).forEach(p=>map.set(p.date.slice(0,7),p));return [...map.values()];}
export function recordMetric(tracking:GrowthState['tracking'],v:{id:string;title:string;unit:string;date:string;value:number}){
 const next=structuredClone(tracking),point=pointSchema.parse({date:v.date,value:v.value}),metric=next.metrics.find(m=>m.id===v.id);
 if(metric){if(metric.unit!==v.unit)throw new Error('Для другой единицы создайте новый показатель');metric.title=v.title;metric.points=[...metric.points.filter(p=>p.date!==v.date),point].sort((a,b)=>a.date.localeCompare(b.date));}else next.metrics.push({id:v.id,title:v.title,unit:v.unit,points:[point]});
 return trackingSchema.parse(next);
}
export const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Krasnoyarsk'});
export function dateLabel(v:string){if(!v)return 'Срок не задан';const d=new Date(v.slice(0,10)+'T12:00:00Z');return Number.isNaN(d.getTime())?v:d.toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});}
export function remaining(v:string){if(!v)return null;const d=new Date(v.slice(0,10)+'T00:00:00Z').getTime();return Number.isNaN(d)?null:Math.round((d-new Date(today()+'T00:00:00Z').getTime())/86400000);}
