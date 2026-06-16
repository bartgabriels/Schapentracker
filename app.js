const expandedPaddocks = new Set()

function ensureDefaultStal(){
  if(state.paddocks.length > 0) return
  const paddockId = uid()
  const zoneId = uid()
  state.paddocks.push({
    id: paddockId,
    name: 'Stal',
    zones: [{ id: zoneId, name: 'Stal', emptySince: Date.now() }]
  })
}

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
  ensureDefaultStal()
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

function exportData(){
  const json = JSON.stringify(state, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `schapentracker-${new Date().toISOString().slice(0,10)}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function importDataFile(file){
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result)
      if(!parsed || typeof parsed !== 'object') throw new Error('Ongeldig bestand')
      state.paddocks = Array.isArray(parsed.paddocks) ? parsed.paddocks.map(p => ({
        id: p.id,
        name: p.name,
        zones: Array.isArray(p.zones) ? p.zones.map(z => ({
          id: z.id,
          name: z.name,
          emptySince: z.emptySince ?? Date.now()
        })) : []
      })) : []
      state.sheep = Array.isArray(parsed.sheep) ? parsed.sheep.map(s => ({
        id: s.id,
        tag: s.tag,
        paddockId: s.paddockId,
        zoneId: s.zoneId ?? null,
        lastUpdated: s.lastUpdated ?? Date.now()
      })) : []
      ensureDefaultStal()
      updateZoneEmptyStates()
      save(); render()
      alert('Gegevens succesvol geladen.')
    } catch (err) {
      alert('Kon bestand niet laden: ' + err.message)
    }
  }
  reader.readAsText(file)
}

function render(){
  updateZoneEmptyStates()
  const paddockList = document.getElementById('paddock-list')
  const sheepList = document.getElementById('sheep-list')
  const sheepPaddockModal = document.getElementById('sheep-paddock-modal')
  const sheepZoneModal = document.getElementById('sheep-zone-modal')
  const movePaddockModal = document.getElementById('move-paddock-modal')
  const moveZoneModal = document.getElementById('move-zone-modal')

  paddockList.innerHTML = state.paddocks.length === 0 ? '<div class="empty">Geen weides</div>' : state.paddocks.map(p => renderPaddock(p)).join('') + `
    <button type="button" class="add-paddock-block" aria-label="Weide toevoegen">+</button>
  `

  sheepList.innerHTML = state.sheep.map(s => `
      <div class="sheep-card">
        <div class="sheep-card-body">
          <strong>${s.tag}</strong>
          <small>${paddockName(s.paddockId)}${s.zoneId ? ' / ' + zoneName(s.paddockId, s.zoneId) : ''}</small>
          <small>Laatst gewijzigd: ${formatDate(s.lastUpdated)} (${daysSince(s.lastUpdated)} dagen geleden)</small>
        </div>
        <div class="sheep-actions">
          <button type="button" class="move-button" data-id="${s.id}">Verplaats</button>
          <button type="button" class="sheep-delete-button" data-id="${s.id}" aria-label="Schaap verwijderen">−</button>
        </div>
      </div>
    `).join('') + `
      <button type="button" class="sheep-card add-sheep-card" id="add-sheep-block" aria-label="Schaap toevoegen">
        <span class="add-zone-icon">+</span>
      </button>
    `

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
  const sheepCount = state.sheep.filter(s => s.paddockId === p.id).length
  const sheepLabel = sheepCount === 1 ? 'schaap' : 'schapen'
  const canDeletePaddock = !isStalPaddock(p)
  return `<div class="card" data-id="${p.id}" ${isExpanded ? 'data-expanded="true"' : ''}>
    <div class="card-header" data-paddock-id="${p.id}" style="cursor:pointer;user-select:none">
      <div class="card-header-main">
        <strong>${p.name}</strong>
        <span class="paddock-sheep-count">${sheepCount} ${sheepLabel}</span>
      </div>
      <div class="card-header-actions">
        <span class="badge">${p.zones.length} zone(s)</span>
        ${canDeletePaddock ? `<button type="button" class="paddock-delete-button" data-paddock-id="${p.id}" aria-label="Weide verwijderen">−</button>` : ''}
      </div>
    </div>
    <div class="zone-list" ${isExpanded ? '' : 'style="display:none"'}>
      ${p.zones.map(z => {
        const sheepInZone = state.sheep.filter(s => s.paddockId === p.id && s.zoneId === z.id)
        const sheepCount = sheepInZone.length
        const status = z.emptySince ? `Leeg sinds ${daysSince(z.emptySince)} dagen` : `Bezet${sheepCount ? ` (${sheepCount})` : ''}`
        const sheepLabel = sheepCount
          ? sheepInZone.map(s => `<button type="button" class="zone-sheep-link" data-sheep-id="${s.id}" aria-label="Verplaats ${s.tag}">${sheepIcon()}${s.tag}</button>`).join(' ')
          : 'Geen schaap'
        const stallZone = isStalZone(p, z)
        const useStallBackground = isStalPaddock(p)
        const canDeleteZone = !stallZone && p.zones.length > 1
        return `<div class="zone-item${useStallBackground ? ' stall-zone-item' : ''}" data-paddock-id="${p.id}" data-zone-id="${z.id}">${canDeleteZone ? `<button type="button" class="zone-delete-button" data-paddock-id="${p.id}" data-zone-id="${z.id}" aria-label="Zone verwijderen">−</button>` : ''}<div><strong>${z.name}</strong><small>${status}</small></div><div class="zone-bottom">${sheepLabel}</div></div>`
      }).join('')}
      <button type="button" class="zone-item add-zone-button${isStalPaddock(p) ? ' stall-zone-item' : ''}" data-paddock-id="${p.id}" aria-label="Zone toevoegen">
        <span class="add-zone-icon">+</span>
      </button>
    </div>
  </div>`


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

function isStalPaddock(paddock){
  return !!paddock && typeof paddock.name === 'string' && paddock.name.toLowerCase() === 'stal'
}

function isStalZone(paddock, zone){
  return isStalPaddock(paddock) && !!zone && typeof zone.name === 'string' && zone.name.toLowerCase() === 'stal'
}

let activeMoveSheepId = null
let pendingZoneDeletion = null
let pendingPaddockDeletion = null

function availableTargetZones(targetPaddockId, sourcePaddockId = pendingZoneDeletion?.sourcePaddockId, sourceZoneId = pendingZoneDeletion?.sourceZoneId){
  const targetPaddock = getPaddock(targetPaddockId)
  if(!targetPaddock) return []
  if(!sourcePaddockId || !sourceZoneId) return targetPaddock.zones
  return targetPaddock.zones.filter(z => !(targetPaddockId === sourcePaddockId && z.id === sourceZoneId))
}

function populateZoneDeleteMoveTargets(selectedPaddockId){
  const paddockSelect = document.getElementById('zone-delete-target-paddock-modal')
  const zoneSelect = document.getElementById('zone-delete-target-zone-modal')
  const submitBtn = document.getElementById('zone-delete-move-submit')
  if(!paddockSelect || !zoneSelect || !pendingZoneDeletion) return

  const sourcePaddock = getPaddock(pendingZoneDeletion.sourcePaddockId)
  if(!sourcePaddock) return

  paddockSelect.innerHTML = `<option value="${sourcePaddock.id}" selected>${sourcePaddock.name}</option>`
  paddockSelect.disabled = true

  const zones = availableTargetZones(sourcePaddock.id, sourcePaddock.id, pendingZoneDeletion.sourceZoneId)
  if(zones.length){
    zoneSelect.innerHTML = `<option value="" selected disabled hidden>Kies zone</option>` + zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('')
    zoneSelect.disabled = false
    if(zones.length === 1){
      zoneSelect.value = zones[0].id
      if(submitBtn) submitBtn.disabled = false
    } else {
      zoneSelect.value = ''
      if(submitBtn) submitBtn.disabled = true
    }
  } else {
    zoneSelect.innerHTML = '<option value="">Geen zones beschikbaar</option>'
    zoneSelect.disabled = true
    if(submitBtn) submitBtn.disabled = true
  }
}

function openZoneDeleteMoveModal(sourcePaddockId, sourceZoneId, sheepCount){
  const sourcePaddock = getPaddock(sourcePaddockId)
  const sourceZone = getZone(sourcePaddockId, sourceZoneId)
  if(!sourcePaddock || !sourceZone) return

  if(isStalZone(sourcePaddock, sourceZone)){
    alert('De Stal-zone kan niet worden verwijderd.')
    return
  }

  if(sourcePaddock.zones.length <= 1){
    alert('Een weide moet minstens 1 zone behouden.')
    return
  }

  const hasTarget = availableTargetZones(sourcePaddockId, sourcePaddockId, sourceZoneId).length > 0
  if(!hasTarget){
    alert('Geen doelzone beschikbaar binnen deze weide.')
    return
  }

  const allTargets = availableTargetZones(sourcePaddockId, sourcePaddockId, sourceZoneId)
    .map(z => ({ paddockId: sourcePaddockId, zoneId: z.id }))
  if(allTargets.length === 1){
    const target = allTargets[0]
    state.sheep.forEach(s => {
      if(s.paddockId === sourcePaddockId && s.zoneId === sourceZoneId){
        s.paddockId = target.paddockId
        s.zoneId = target.zoneId
        s.lastUpdated = Date.now()
      }
    })
    sourcePaddock.zones = sourcePaddock.zones.filter(z => z.id !== sourceZoneId)
    save(); render()
    return
  }

  const sourceLabel = document.getElementById('zone-delete-source-name')
  const sheepLabel = document.getElementById('zone-delete-sheep-count')
  if(sourceLabel){
    sourceLabel.textContent = `${sourcePaddock.name} / ${sourceZone.name}`
  }
  if(sheepLabel){
    sheepLabel.textContent = `${sheepCount} schaap${sheepCount === 1 ? '' : 'en'}`
  }

  pendingZoneDeletion = { sourcePaddockId, sourceZoneId }

  populateZoneDeleteMoveTargets(sourcePaddockId)
  openModal('zone-delete-move-modal')
}

function closeZoneDeleteMoveModal(){
  pendingZoneDeletion = null
  closeModal('zone-delete-move-modal')
}

function availableTargetPaddocksForDelete(sourcePaddockId){
  return state.paddocks.filter(p => p.id !== sourcePaddockId && p.zones.length > 0)
}

function populatePaddockDeleteMoveTargets(selectedPaddockId){
  const paddockSelect = document.getElementById('paddock-delete-target-paddock-modal')
  const zoneSelect = document.getElementById('paddock-delete-target-zone-modal')
  const submitBtn = document.getElementById('paddock-delete-move-submit')
  if(!paddockSelect || !zoneSelect || !pendingPaddockDeletion) return

  const targetPaddocks = availableTargetPaddocksForDelete(pendingPaddockDeletion.sourcePaddockId)
  paddockSelect.innerHTML = `<option value="" selected disabled hidden>Kies weide</option>` + targetPaddocks.map(p => `<option value="${p.id}"${p.id === selectedPaddockId ? ' selected' : ''}>${p.name}</option>`).join('')

  const targetPaddockId = selectedPaddockId || paddockSelect.value
  const targetPaddock = getPaddock(targetPaddockId)
  const zones = targetPaddock ? targetPaddock.zones : []
  if(zones.length){
    zoneSelect.innerHTML = `<option value="" selected disabled hidden>Kies zone</option>` + zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('')
    zoneSelect.disabled = false
    if(zones.length === 1){
      zoneSelect.value = zones[0].id
      if(submitBtn) submitBtn.disabled = false
    } else {
      zoneSelect.value = ''
      if(submitBtn) submitBtn.disabled = true
    }
  } else {
    zoneSelect.innerHTML = '<option value="">Geen zones beschikbaar</option>'
    zoneSelect.disabled = true
    if(submitBtn) submitBtn.disabled = true
  }
}

function openPaddockDeleteMoveModal(sourcePaddockId, sheepCount){
  const sourcePaddock = getPaddock(sourcePaddockId)
  if(!sourcePaddock) return

  const targetPaddocks = availableTargetPaddocksForDelete(sourcePaddockId)
  if(!targetPaddocks.length){
    alert('Deze weide bevat schapen. Er moet eerst een andere weide met minstens 1 zone zijn om de schapen te verplaatsen.')
    return
  }

  const allTargets = targetPaddocks.flatMap(p => p.zones.map(z => ({ paddockId: p.id, zoneId: z.id })))
  if(allTargets.length === 1){
    const target = allTargets[0]
    state.sheep.forEach(s => {
      if(s.paddockId === sourcePaddockId){
        s.paddockId = target.paddockId
        s.zoneId = target.zoneId
        s.lastUpdated = Date.now()
      }
    })
    state.paddocks = state.paddocks.filter(p => p.id !== sourcePaddockId)
    expandedPaddocks.delete(sourcePaddockId)
    save(); render()
    return
  }

  pendingPaddockDeletion = { sourcePaddockId }

  const sourceLabel = document.getElementById('paddock-delete-source-name')
  const sheepLabel = document.getElementById('paddock-delete-sheep-count')
  if(sourceLabel){
    sourceLabel.textContent = sourcePaddock.name
  }
  if(sheepLabel){
    sheepLabel.textContent = `${sheepCount} schaap${sheepCount === 1 ? '' : 'en'}`
  }

  populatePaddockDeleteMoveTargets(targetPaddocks[0].id)
  openModal('paddock-delete-move-modal')
}

function closePaddockDeleteMoveModal(){
  pendingPaddockDeletion = null
  closeModal('paddock-delete-move-modal')
}

function populateMoveModalPaddocks(selectedPaddockId){
  const movePaddockModal = document.getElementById('move-paddock-modal')
  const moveZoneModal = document.getElementById('move-zone-modal')
  const submitBtn = document.getElementById('move-modal-submit')
  if(!movePaddockModal || !moveZoneModal) return

  movePaddockModal.innerHTML = `<option value="" selected disabled hidden>Kies weide</option>` + state.paddocks.map(p => `<option value="${p.id}"${p.id === selectedPaddockId ? ' selected' : ''}>${p.name}</option>`).join('')

  const selected = getPaddock(selectedPaddockId)
  if(selected && selected.zones.length){
    moveZoneModal.innerHTML = `<option value="" selected disabled hidden>Kies zone</option>` + selected.zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('')
    moveZoneModal.disabled = false
    if(selected.zones.length === 1){
      moveZoneModal.value = selected.zones[0].id
      if(submitBtn) submitBtn.disabled = false
    } else {
      moveZoneModal.value = ''
      if(submitBtn) submitBtn.disabled = true
    }
  } else {
    moveZoneModal.innerHTML = selected ? '<option value="">Geen zones beschikbaar</option>' : '<option value="">Kies eerst een weide</option>'
    moveZoneModal.disabled = !selected || selected.zones.length === 0
    if(submitBtn) submitBtn.disabled = true
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

document.getElementById('download-data-btn')?.addEventListener('click', exportData)

document.getElementById('upload-data-btn')?.addEventListener('click', () => {
  document.getElementById('upload-data-input')?.click()
})

document.getElementById('clear-data-btn')?.addEventListener('click', () => {
  if(!confirm('Weet je zeker dat je alle gegevens wilt wissen? Dit kan niet ongedaan worden gemaakt.')) return
  state.paddocks = []
  state.sheep = []
  expandedPaddocks.clear()
  ensureDefaultStal()
  localStorage.removeItem(KEY)
  save()
  render()
})

document.getElementById('upload-data-input')?.addEventListener('change', e => {
  const files = e.target.files
  if(files && files.length){
    importDataFile(files[0])
  }
  e.target.value = ''
})


document.getElementById('paddock-modal-close')?.addEventListener('click', () => closeModal('paddock-modal'))
document.getElementById('paddock-modal-backdrop')?.addEventListener('click', () => closeModal('paddock-modal'))

document.getElementById('sheep-modal-close')?.addEventListener('click', () => closeModal('sheep-modal'))
document.getElementById('sheep-modal-backdrop')?.addEventListener('click', () => closeModal('sheep-modal'))

document.getElementById('zone-modal-close')?.addEventListener('click', () => closeModal('zone-modal'))
document.getElementById('zone-modal-backdrop')?.addEventListener('click', () => closeModal('zone-modal'))

document.getElementById('zone-delete-move-modal-close')?.addEventListener('click', closeZoneDeleteMoveModal)
document.getElementById('zone-delete-move-modal-backdrop')?.addEventListener('click', closeZoneDeleteMoveModal)

document.getElementById('paddock-delete-move-modal-close')?.addEventListener('click', closePaddockDeleteMoveModal)
document.getElementById('paddock-delete-move-modal-backdrop')?.addEventListener('click', closePaddockDeleteMoveModal)

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
    populateMoveModalPaddocks(movePaddockModal.value)
  })
}

const moveZoneModal = document.getElementById('move-zone-modal')
if(moveZoneModal){
  moveZoneModal.addEventListener('change', () => {
    const submitBtn = document.getElementById('move-modal-submit')
    if(submitBtn){
      submitBtn.disabled = !moveZoneModal.value
    }
  })
}

const zoneDeleteTargetPaddockModal = document.getElementById('zone-delete-target-paddock-modal')
if(zoneDeleteTargetPaddockModal){
  zoneDeleteTargetPaddockModal.addEventListener('change', () => {
    populateZoneDeleteMoveTargets(zoneDeleteTargetPaddockModal.value)
  })
}

const zoneDeleteTargetZoneModal = document.getElementById('zone-delete-target-zone-modal')
if(zoneDeleteTargetZoneModal){
  zoneDeleteTargetZoneModal.addEventListener('change', () => {
    const submitBtn = document.getElementById('zone-delete-move-submit')
    if(submitBtn){
      submitBtn.disabled = !zoneDeleteTargetZoneModal.value
    }
  })
}

const paddockDeleteTargetPaddockModal = document.getElementById('paddock-delete-target-paddock-modal')
if(paddockDeleteTargetPaddockModal){
  paddockDeleteTargetPaddockModal.addEventListener('change', () => {
    populatePaddockDeleteMoveTargets(paddockDeleteTargetPaddockModal.value)
  })
}

const paddockDeleteTargetZoneModal = document.getElementById('paddock-delete-target-zone-modal')
if(paddockDeleteTargetZoneModal){
  paddockDeleteTargetZoneModal.addEventListener('change', () => {
    const submitBtn = document.getElementById('paddock-delete-move-submit')
    if(submitBtn){
      submitBtn.disabled = !paddockDeleteTargetZoneModal.value
    }
  })
}

document.getElementById('zone-delete-move-form')?.addEventListener('submit', e => {
  e.preventDefault()
  if(!pendingZoneDeletion) return

  const targetPaddockId = pendingZoneDeletion.sourcePaddockId
  const targetZoneId = document.getElementById('zone-delete-target-zone-modal').value
  if(!targetPaddockId || !targetZoneId) return

  const sourcePaddock = getPaddock(pendingZoneDeletion.sourcePaddockId)
  if(!sourcePaddock) return

  state.sheep.forEach(s => {
    if(s.paddockId === pendingZoneDeletion.sourcePaddockId && s.zoneId === pendingZoneDeletion.sourceZoneId){
      s.paddockId = targetPaddockId
      s.zoneId = targetZoneId
      s.lastUpdated = Date.now()
    }
  })

  sourcePaddock.zones = sourcePaddock.zones.filter(z => z.id !== pendingZoneDeletion.sourceZoneId)
  save(); render(); closeZoneDeleteMoveModal()
})

document.getElementById('paddock-delete-move-form')?.addEventListener('submit', e => {
  e.preventDefault()
  if(!pendingPaddockDeletion) return

  const targetPaddockId = document.getElementById('paddock-delete-target-paddock-modal').value
  const targetZoneId = document.getElementById('paddock-delete-target-zone-modal').value
  if(!targetPaddockId || !targetZoneId) return

  state.sheep.forEach(s => {
    if(s.paddockId === pendingPaddockDeletion.sourcePaddockId){
      s.paddockId = targetPaddockId
      s.zoneId = targetZoneId
      s.lastUpdated = Date.now()
    }
  })

  state.paddocks = state.paddocks.filter(p => p.id !== pendingPaddockDeletion.sourcePaddockId)
  expandedPaddocks.delete(pendingPaddockDeletion.sourcePaddockId)
  save(); render(); closePaddockDeleteMoveModal()
})

document.getElementById('move-modal-close')?.addEventListener('click', () => closeModal('move-modal'))

document.getElementById('move-modal-backdrop')?.addEventListener('click', () => closeModal('move-modal'))

document.getElementById('sheep-list')?.addEventListener('click', e => {
  const button = e.target.closest('.move-button')
  if(button){
    openMoveModal(button.dataset.id)
    return
  }

  const deleteButton = e.target.closest('.sheep-delete-button')
  if(deleteButton){
    const sheepId = deleteButton.dataset.id
    if(!sheepId) return
    state.sheep = state.sheep.filter(s => s.id !== sheepId)
    save(); render()
    return
  }

  const addBlock = e.target.closest('#add-sheep-block')
  if(addBlock){
    openModal('sheep-modal')
  }
})

document.getElementById('paddock-list').addEventListener('click', e => {
  const addPaddockButton = e.target.closest('.add-paddock-block')
  if(addPaddockButton){
    openModal('paddock-modal')
    return
  }

  const zoneSheepLink = e.target.closest('.zone-sheep-link')
  if(zoneSheepLink){
    const sheepId = zoneSheepLink.dataset.sheepId
    if(!sheepId) return
    openMoveModal(sheepId)
    return
  }

  const deletePaddockButton = e.target.closest('.paddock-delete-button')
  if(deletePaddockButton){
    const paddockId = deletePaddockButton.dataset.paddockId
    if(!paddockId) return
    const paddock = getPaddock(paddockId)
    if(isStalPaddock(paddock)){
      alert('De weide Stal kan niet worden verwijderd.')
      return
    }
    const sheepInPaddock = state.sheep.filter(s => s.paddockId === paddockId)
    if(sheepInPaddock.length){
      openPaddockDeleteMoveModal(paddockId, sheepInPaddock.length)
      return
    }
    state.paddocks = state.paddocks.filter(p => p.id !== paddockId)
    expandedPaddocks.delete(paddockId)
    save(); render()
    return
  }

  const deleteZoneButton = e.target.closest('.zone-delete-button')
  if(deleteZoneButton){
    const paddockId = deleteZoneButton.dataset.paddockId || deleteZoneButton.dataset.paddockId
    const zoneId = deleteZoneButton.dataset.zoneId
    const paddock = getPaddock(paddockId)
    if(!paddock || !zoneId) return

    const zone = getZone(paddockId, zoneId)
    if(!zone) return

    if(isStalZone(paddock, zone)){
      alert('De Stal-zone kan niet worden verwijderd.')
      return
    }

    if(paddock.zones.length <= 1){
      alert('Een weide moet minstens 1 zone behouden.')
      return
    }

    const sheepInZone = state.sheep.filter(s => s.paddockId === paddockId && s.zoneId === zoneId)
    if(sheepInZone.length){
      openZoneDeleteMoveModal(paddockId, zoneId, sheepInZone.length)
      return
    }

    paddock.zones = paddock.zones.filter(z => z.id !== zoneId)
    save(); render()
    return
  }

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

load(); render()
