import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import './selectMenu.css'
type Option = { value: string; label: string }
export function SelectMenu({ label, value, options, onChange }: { label: string; value: string; options: Option[]; onChange: (value: string) => void }) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false), [active, setActive] = useState(0)
  const [position, setPosition] = useState({ left: 0, top: 0, width: 200, maxHeight: 320 })
  const typed = useRef({ text: '', time: 0 })
  const selected = options.findIndex(option => option.value === value)
  const show = () => { setActive(Math.max(0, selected)); setOpen(true) }
  const choose = (index: number) => { if (options[index]) onChange(options[index].value); setOpen(false); trigger.current?.focus() }
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(Math.max(rect.width, 200), window.innerWidth - 16)
      const below = window.innerHeight - rect.bottom - 14, above = rect.top - 14
      const upward = below < 200 && above > below
      const maxHeight = Math.max(40, Math.min(320, upward ? above : below))
      const height = Math.min(maxHeight, options.length * 36 + 12)
      setPosition({ left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
        top: upward ? rect.top - height - 6 : rect.bottom + 6, width, maxHeight })
    }
    place()
    const scroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) place() }
    window.addEventListener('resize', place); window.addEventListener('scroll', scroll, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', scroll, true) }
  }, [open, options.length])
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const { key } = event
    if (key === 'Tab') { setOpen(false); return }
    if (key === 'Escape') { if (open) { event.preventDefault(); event.stopPropagation(); setOpen(false) }; return }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault()
      if (!open) show()
      else setActive(index => Math.max(0, Math.min(options.length - 1, index + (key === 'ArrowDown' ? 1 : -1))))
    } else if (key === 'Home' || key === 'End') {
      event.preventDefault(); setActive(key === 'Home' ? 0 : options.length - 1); setOpen(true)
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault(); if (open) choose(active); else show()
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = performance.now()
      typed.current = { text: (now - typed.current.time < 700 ? typed.current.text : '') + key.toLowerCase(), time: now }
      const index = options.findIndex(option => option.label.toLowerCase().startsWith(typed.current.text))
      if (index >= 0) { event.preventDefault(); setActive(index); setOpen(true) }
    }
  }
  return <div className="ui-select">
    <button ref={trigger} type="button" className="ui-select-trigger" role="combobox" aria-label={label}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
      aria-activedescendant={open ? `${id}-${active}` : undefined}
      onClick={() => open ? setOpen(false) : show()} onKeyDown={keyDown}>
      <span>{options[selected]?.label ?? label}</span><ChevronDown size={14} aria-hidden="true" />
    </button>
    {open && createPortal(<div ref={menu} id={id} role="listbox" aria-label={label} className="ui-select-menu" style={position}>
      {options.map((option, index) => <div id={`${id}-${index}`} key={option.value} data-index={index} role="option"
        aria-selected={option.value === value} className={`ui-select-option${index === active ? ' is-active' : ''}`}
        onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
        <span>{option.label}</span>{option.value === value && <Check size={14} aria-hidden="true" />}
      </div>)}
    </div>, document.body)}
  </div>
}
