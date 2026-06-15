const KEY = 'schapentracker:data'
const state = { paddocks: [], sheep: [] }
const expandedPaddocks = new Set()

function load(){
  const raw = localStorage.getItem(KEY)
  if(raw){
    const saved = JSON.parse(raw)
    state.paddocks = Array.isArray(saved.paddocks) ? saved.paddocks.map(p => ({
      id: p.id,
      name: p.name,
      zones: Array.isArray(p.zones) ? p.zones.map(z => ({
        id: z.id,
        name: z.name,
        emptySince: z.emptySince ?? Date.now()
      })) : []
    })) : []
    state.sheep = Array.isArray(saved.sheep) ? saved.sheep.map(s => ({
      id: s.id,
      tag: s.tag,
      paddockId: s.paddockId,
      zoneId: s.zoneId ?? null,
      lastUpdated: s.lastUpdated ?? Date.now()
    })) : []
  }
  updateZoneEmptyStates()
}

function save(){
  updateZoneEmptyStates()
  localStorage.setItem(KEY, JSON.stringify(state))
}

function formatDate(timestamp){
  return new Date(timestamp).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function daysSince(timestamp){
  if(!timestamp) return '-'
  const diff = Date.now() - timestamp
  return Math.floor(diff / 86400000)
}

function updateZoneEmptyStates(){
  state.paddocks.forEach(p => {
    p.zones.forEach(z => {
      const assigned = state.sheep.some(s => s.paddockId === p.id && s.zoneId === z.id)
      if(assigned){
        z.emptySince = null
      } else if(!z.emptySince){
        z.emptySince = Date.now()
      }
    })
  })
}

function render(){
  updateZoneEmptyStates()
  const paddockList = document.getElementById('paddock-list')
  const sheepList = document.getElementById('sheep-list')
  const sheepPaddockModal = document.getElementById('sheep-paddock-modal')
  const sheepZoneModal = document.getElementById('sheep-zone-modal')
  const movePaddockModal = document.getElementById('move-paddock-modal')
  const moveZoneModal = document.getElementById('move-zone-modal')

  paddockList.innerHTML = state.paddocks.length === 0 ? '<div class="empty">Geen weides</div>' : state.paddocks.map(p => renderPaddock(p)).join('')

  sheepList.innerHTML = state.sheep.length === 0 ? '<li><em>Geen schapen</em></li>' : state.sheep.map(s => `
    <li>
      <div class="sheep-line">
        <strong>${s.tag}</strong>
        <button type="button" class="move-button" data-id="${s.id}">Verplaats</button>
      </div>
      ${paddockName(s.paddockId)}${s.zoneId ? ' / ' + zoneName(s.paddockId, s.zoneId) : ''}<br>
      <small>Laatst gewijzigd: ${formatDate(s.lastUpdated)} (${daysSince(s.lastUpdated)} dagen geleden)</small>
    </li>
  `).join('')

  if(sheepPaddockModal){
    populatePaddockSelect(sheepPaddockModal)
    sheepPaddockModal.value = ''
  }

  if(sheepZoneModal){
    sheepZoneModal.innerHTML = '<option value="">Kies eerst een weide</option>'
    sheepZoneModal.disabled = true
  }

  if(movePaddockModal){
    populatePaddockSelect(movePaddockModal)
  }
  if(moveZoneModal){
    moveZoneModal.innerHTML = '<option value="">Kies eerst een weide</option>'
    moveZoneModal.disabled = true
  }
}

function renderPaddock(p){
  const isExpanded = expandedPaddocks.has(p.id)
  return `<div class="card" data-id="${p.id}" ${isExpanded ? 'data-expanded="true"' : ''}>
    <div class="card-header" data-paddock-id="${p.id}" style="cursor:pointer;user-select:none">
      <strong>${p.name}</strong>
      <span class="badge">${p.zones.length} zone(s)</span>
    </div>
    <div class="zone-list" ${isExpanded ? '' : 'style="display:none"'}>
      ${p.zones.length === 0 ? '<div class="empty-zone">Geen zones</div>' : p.zones.map(z => {
        const status = z.emptySince ? `Leeg sinds ${daysSince(z.emptySince)} dagen` : 'Bezet'
        const sheepNames = zoneSheepNames(p.id, z.id)
        const sheepLabel = sheepNames.length ? sheepNames.map(name => `${sheepIcon()}${name}`).join(' ') : 'Geen schaap'
        return `<div class="zone-item"><div><strong>${z.name}</strong><small>${status}</small></div><div class="zone-bottom">${sheepLabel}</div></div>`
      }).join('')}
    </div>
    <button type="button" class="add-zone-button" data-paddock-id="${p.id}" ${isExpanded ? '' : 'style="display:none"'}>Zone toevoegen</button>
  </div>`
}

function paddockName(id){
  const p = state.paddocks.find(x=>x.id===id)
  return p ? p.name : 'Onbekend'
}

function zoneName(paddockId, zoneId){
  const zone = getZone(paddockId, zoneId)
  return zone ? zone.name : 'Onbekend'
}

function getPaddock(id){ return state.paddocks.find(x => x.id === id) }

function getZone(paddockId, zoneId){
  const paddock = getPaddock(paddockId)
  return paddock ? paddock.zones.find(x => x.id === zoneId) : null
}

function populatePaddockSelect(select){
  if(!select) return
  select.innerHTML = `<option value="" selected disabled hidden>Kies weide</option>` + state.paddocks.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
}

function zoneSheepNames(paddockId, zoneId){
  return state.sheep
    .filter(s => s.paddockId === paddockId && s.zoneId === zoneId)
    .map(s => s.tag)
}

function sheepIcon(){
  return `<img src="schaap.png" alt="schaap" class="sheep-icon"/>`
}

function uid(){ return Math.random().toString(36).slice(2,9) }

let activeMoveSheepId = null

function populateMoveModalPaddocks(selectedPaddockId){
  const movePaddockModal = document.getElementById('move-paddock-modal')
  const moveZoneModal = document.getElementById('move-zone-modal')
  if(!movePaddockModal || !moveZoneModal) return

  movePaddockModal.innerHTML = `<option value="" selected disabled hidden>Kies weide</option>` + state.paddocks.map(p => `<option value="${p.id}"${p.id === selectedPaddockId ? ' selected' : ''}>${p.name}</option>`).join('')

  const selected = getPaddock(selectedPaddockId)
  if(selected && selected.zones.length){
    moveZoneModal.innerHTML = `<option value="" selected disabled hidden>Kies zone</option>` + selected.zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('')
    moveZoneModal.disabled = false
  } else {
    moveZoneModal.innerHTML = selected ? '<option value="">Geen zones beschikbaar</option>' : '<option value="">Kies eerst een weide</option>'
    moveZoneModal.disabled = !selected || selected.zones.length === 0
  }
}

function openMoveModal(sheepId){
  const sheep = state.sheep.find(s => s.id === sheepId)
  if(!sheep) return
  activeMoveSheepId = sheepId

  const label = document.getElementById('move-modal-sheep-name')
  if(label){
    label.textContent = `${sheep.tag} — ${paddockName(sheep.paddockId)}${sheep.zoneId ? ' / ' + zoneName(sheep.paddockId, sheep.zoneId) : ''}`
  }

  populateMoveModalPaddocks(sheep.paddockId)
  const moveZoneModal = document.getElementById('move-zone-modal')
  if(moveZoneModal && sheep.zoneId){
    moveZoneModal.value = sheep.zoneId
  }

  const modal = document.getElementById('move-modal')
  if(modal){
    modal.classList.remove('hidden')
    modal.setAttribute('aria-hidden', 'false')
  }
}

function openModal(id){
  const modal = document.getElementById(id)
  if(!modal) return
  modal.classList.remove('hidden')
  modal.setAttribute('aria-hidden', 'false')
}

function closeModal(id){
  const modal = document.getElementById(id)
  if(!modal) return
  modal.classList.add('hidden')
  modal.setAttribute('aria-hidden', 'true')
}

document.getElementById('open-paddock-modal-btn')?.addEventListener('click', () => {
  openModal('paddock-modal')
})

document.getElementById('open-sheep-modal-btn')?.addEventListener('click', () => {
  openModal('sheep-modal')
})

document.getElementById('paddock-modal-close')?.addEventListener('click', () => closeModal('paddock-modal'))
document.getElementById('paddock-modal-backdrop')?.addEventListener('click', () => closeModal('paddock-modal'))

document.getElementById('sheep-modal-close')?.addEventListener('click', () => closeModal('sheep-modal'))
document.getElementById('sheep-modal-backdrop')?.addEventListener('click', () => closeModal('sheep-modal'))

document.getElementById('zone-modal-close')?.addEventListener('click', () => closeModal('zone-modal'))
document.getElementById('zone-modal-backdrop')?.addEventListener('click', () => closeModal('zone-modal'))

document.getElementById('move-modal-form')?.addEventListener('submit', e => {
  e.preventDefault()
  if(!activeMoveSheepId) return
  const paddockId = document.getElementById('move-paddock-modal').value
  const zoneId = document.getElementById('move-zone-modal').value
  const sheep = state.sheep.find(x => x.id === activeMoveSheepId)
  if(!sheep || !paddockId) return
  sheep.paddockId = paddockId
  sheep.zoneId = zoneId || null
  sheep.lastUpdated = Date.now()
  save(); render(); closeModal('move-modal')
})

document.getElementById('paddock-modal-form')?.addEventListener('submit', e => {
  e.preventDefault()
  const name = document.getElementById('paddock-modal-name').value.trim()
  if(!name) return
  state.paddocks.push({id:uid(), name, zones: []})
  document.getElementById('paddock-modal-name').value = ''
  save(); render(); closeModal('paddock-modal')
})

document.getElementById('sheep-modal-form')?.addEventListener('submit', e => {
  e.preventDefault()
  const tag = document.getElementById('sheep-modal-tag').value.trim()
  const paddockId = document.getElementById('sheep-paddock-modal').value
  const zoneId = document.getElementById('sheep-zone-modal').value
  if(!tag || !paddockId) return
  state.sheep.push({id:uid(), tag, paddockId, zoneId: zoneId || null, lastUpdated: Date.now()})
  document.getElementById('sheep-modal-tag').value = ''
  document.getElementById('sheep-zone-modal').value = ''
  save(); render(); closeModal('sheep-modal')
})

const sheepPaddockModal = document.getElementById('sheep-paddock-modal')
if(sheepPaddockModal){
  sheepPaddockModal.addEventListener('change', () => {
    const sheepZoneModal = document.getElementById('sheep-zone-modal')
    const selectedPaddock = getPaddock(sheepPaddockModal.value)
    if(selectedPaddock && selectedPaddock.zones.length){
      sheepZoneModal.innerHTML = `<option value="" selected disabled hidden>Kies zone</option>` + selectedPaddock.zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('')
      sheepZoneModal.disabled = false
    } else {
      sheepZoneModal.innerHTML = selectedPaddock ? '<option value="">Geen zones beschikbaar</option>' : '<option value="">Kies eerst een weide</option>'
      sheepZoneModal.disabled = !selectedPaddock || selectedPaddock.zones.length === 0
    }
  })
}

const movePaddockModal = document.getElementById('move-paddock-modal')
if(movePaddockModal){
  movePaddockModal.addEventListener('change', () => {
    const selected = getPaddock(movePaddockModal.value)
    const moveZoneModal = document.getElementById('move-zone-modal')
    if(!moveZoneModal) return
    if(selected && selected.zones.length){
      moveZoneModal.innerHTML = `<option value="" selected disabled hidden>Kies zone</option>` + selected.zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('')
      moveZoneModal.disabled = false
    } else {
      moveZoneModal.innerHTML = selected ? '<option value="">Geen zones beschikbaar</option>' : '<option value="">Kies eerst een weide</option>'
      moveZoneModal.disabled = !selected || selected.zones.length === 0
    }
  })
}

document.getElementById('move-modal-close')?.addEventListener('click', () => closeModal('move-modal'))

document.getElementById('move-modal-backdrop')?.addEventListener('click', () => closeModal('move-modal'))

document.getElementById('sheep-list')?.addEventListener('click', e => {
  const button = e.target.closest('.move-button')
  if(!button) return
  openMoveModal(button.dataset.id)
})

document.getElementById('paddock-list').addEventListener('click', e => {
  const zoneButton = e.target.closest('.add-zone-button')
  if(zoneButton){
    const paddockId = zoneButton.dataset.paddockId
    const paddock = getPaddock(paddockId)
    if(!paddock) return
    document.getElementById('zone-modal-paddock-name').textContent = paddock.name
    document.getElementById('zone-modal-form').dataset.paddockId = paddockId
    document.getElementById('zone-modal-name').value = ''
    openModal('zone-modal')
    return
  }

  const header = e.target.closest('.card-header')
  if(!header) return
  const paddockId = header.dataset.paddockId
  if(!paddockId) return
  if(expandedPaddocks.has(paddockId)){
    expandedPaddocks.delete(paddockId)
  } else {
    expandedPaddocks.add(paddockId)
  }
  render()
})

document.getElementById('zone-modal-form')?.addEventListener('submit', e => {
  e.preventDefault()
  const paddockId = e.target.dataset.paddockId
  const zoneName = document.getElementById('zone-modal-name').value.trim()
  if(!zoneName || !paddockId) return
  const paddock = getPaddock(paddockId)
  if(!paddock) return
  paddock.zones.push({id:uid(),name:zoneName,emptySince: Date.now()})
  save(); render(); closeModal('zone-modal')
})

function openMoveModal(sheepId){
  const sheep = state.sheep.find(s => s.id === sheepId)
  if(!sheep) return
  activeMoveSheepId = sheepId

  const label = document.getElementById('move-modal-sheep-name')
  if(label){
    label.textContent = `${sheep.tag} — ${paddockName(sheep.paddockId)}${sheep.zoneId ? ' / ' + zoneName(sheep.paddockId, sheep.zoneId) : ''}`
  }

  populateMoveModalPaddocks(sheep.paddockId)
  const moveZoneModal = document.getElementById('move-zone-modal')
  if(moveZoneModal && sheep.zoneId){
    moveZoneModal.value = sheep.zoneId
  }

  openModal('move-modal')
}

load(); render()
