import { component, groupRows, type EntityRow } from './editor'
import type { SavedObjectInstance } from './model'
import type { ParsedSave } from './save'
export interface DuplicantRow extends EntityRow { key:string; tag:string; model:'organic'|'bionic' }
/** A prefab group is not a population: organic and bionic minions have separate tags. */
export function isDuplicant(tag:string,instance:SavedObjectInstance):boolean {
  return tag==='Minion'||tag==='BionicMinion'||Boolean(component(instance,'MinionIdentity'))
}
export function duplicantRows(save:ParsedSave):DuplicantRow[] {
  return (save.manager?.groups??[]).filter(group=>group.instances.some(instance=>isDuplicant(group.tag,instance))).flatMap(group=>groupRows(group)
    .filter(row=>isDuplicant(group.tag,row.instance))
    .map(row=>({...row,key:`${group.tag}:${row.index}`,tag:group.tag,model:group.tag==='BionicMinion'?'bionic' as const:'organic' as const})))
}
