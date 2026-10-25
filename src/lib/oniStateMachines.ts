import { ByteReader } from './binary'
import { readObjectMembers } from './deserialize'
import type { ObjectValue } from './model'
import type { TypeTemplate } from './types'

export interface OniSavedStateMachine {
  typeName: string
  typeSuffix: string | null
  currentState: string
  entryData: Uint8Array
}

/**
 * Reads StateMachineController's ISaveLoadableDetails payload as written by
 * StateMachineSerializer v12/v20. Entry data and parameters are length-prefixed,
 * so renderer state can be recovered without deserializing the game classes.
 */
export function readOniStateMachines(details: Uint8Array | null | undefined): OniSavedStateMachine[] {
  if (!details || details.byteLength < 12) return []
  try {
    const reader = new ByteReader(details)
    const version = reader.readI32()
    const payloadLength = reader.readI32()
    const payloadEnd = Math.min(reader.length, reader.position + Math.max(0, payloadLength))
    if (version < 12 || reader.position + 4 > payloadEnd) return []
    const count = reader.readI32()
    if (count < 0 || count > 4096) return []
    const states: OniSavedStateMachine[] = []
    for (let index = 0; index < count && reader.position < payloadEnd; index++) {
      if (reader.remaining < 4) break
      reader.readI32() // Reserved entry marker in StateMachineSerializer.Entry.
      const typeName = reader.readKleiString()
      const typeSuffix = version >= 20 || version === 11 ? reader.readKleiString() : null
      const currentState = reader.readKleiString()
      const entryDataLength = reader.readI32()
      if (entryDataLength < 0 || reader.position + entryDataLength > payloadEnd) return []
      const entryData = reader.readBytes(entryDataLength)
      if (typeName && currentState) states.push({ typeName, typeSuffix, currentState, entryData })
    }
    return states
  } catch {
    return []
  }
}

export function oniStateMachineState(details: Uint8Array | null | undefined, typeName: string): string | undefined {
  const expected = typeName.toLowerCase()
  return readOniStateMachines(details).find((state) => state.typeName.toLowerCase().includes(expected))?.currentState
}

/** Decode a machine using the save's own template directory before reading parameters. */
export function readOniMachineData(machine: OniSavedStateMachine, templates: Map<string, TypeTemplate>) {
  const parameters = new Map<string, Uint8Array>()
  let value: ObjectValue | undefined
  try {
    const reader = new ByteReader(machine.entryData)
    if (templates.has(machine.typeName)) value = readObjectMembers(reader, machine.typeName, templates)
    const count = reader.readI32()
    if (count < 0 || count > 4096) return { value, parameters }
    for (let i = 0; i < count; i++) {
      const length = reader.readI32()
      const end = reader.position + length
      if (length < 0 || end > reader.length) break
      reader.readKleiString() // Parameter context type.
      const name = reader.readKleiString()
      const data = reader.readBytes(end - reader.position)
      if (name) parameters.set(name, data)
    }
  } catch { /* Older or unavailable templates leave the visual fallback intact. */ }
  return { value, parameters }
}
