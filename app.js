const KEY = 'schapentracker:data'
const state = { paddocks: [], sheep: [], history: [] }
let expandedPaddockId = null
const expandedWeatherPaddocks = new Set()
const weatherCache = {}
const weatherLoading = new Set()
const WEATHER_TTL_MS = 60 * 60 * 1000

function detectPostcodeCountry(postcode){
  const normalized = postcode.trim().toUpperCase().replace(/\s+/g, '')
  if(/^\d{4}$/.test(normalized)) return 'BE'
  if(/^\d{4}[A-Z]{2}$/.test(normalized)) return 'NL'
  return null
}

function weatherLabel(code){
  if(code === 0) return 'Zonnig'
  if(code >= 1 && code <= 2) return 'Halfbewolkt'
  if(code === 3) return 'Bewolkt'
  if(code >= 45 && code <= 48) return 'Mist'
  if((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'Regen'
  if((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'Sneeuw'
  if(code >= 95) return 'Onweer'
  return 'Wisselend'
}

function formatForecastDay(dateString){
  return new Date(`${dateString}T12:00:00`).toLocaleDateString('nl-NL', {
    weekday: 'short', day: '2-digit', month: '2-digit'
  })
}

async function fetchJson(url){
  const response = await fetch(url)
  if(!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

async function resolveCoordinatesViaNominatim(postcode, country){
  const normalizedPostcode = postcode.trim().toUpperCase().replace(/\s+/g, '')
  const url = `https://nominatim.openstreetmap.org/search?countrycodes=${country.toLowerCase()}&postalcode=${encodeURIComponent(normalizedPostcode)}&format=jsonv2&limit=1`
  const data = await fetchJson(url)
  if(Array.isArray(data) && data.length){
    const place = data[0]
    const lat = Number(place.lat)
    const lon = Number(place.lon)
    if(Number.isFinite(lat) && Number.isFinite(lon)){
      return { lat, lon, country, place: place.name || place.display_name || normalizedPostcode }
    }
  }
  throw new Error('Postcode niet gevonden')
}

async function resolveCoordinatesByPostcode(postcode){
  const country = detectPostcodeCountry(postcode)
  if(!country) throw new Error('Onbekend postcodeformaat')

  const normalizedPostcode = country === 'NL'
    ? postcode.trim().toUpperCase().replace(/\s+/g, '')
    : postcode.trim()

  try {
    const url = `https://api.zippopotam.us/${country}/${encodeURIComponent(normalizedPostcode)}`
    const data = await fetchJson(url)
    if(Array.isArray(data.places) && data.places.length){
      const place = data.places[0]
      const lat = Number(place.latitude)
      const lon = Number(place.longitude)
      if(Number.isFinite(lat) && Number.isFinite(lon)){
        return { lat, lon, country, place: place['place name'] || normalizedPostcode }
      }
    }
  } catch (err) {
    return resolveCoordinatesViaNominatim(normalizedPostcode, country)
  }

  return resolveCoordinatesViaNominatim(normalizedPostcode, country)
}

async function loadWeatherForPostcode(postcode){
  if(weatherLoading.has(postcode)) return
  weatherLoading.add(postcode)
  try {
    const coords = await resolveCoordinatesByPostcode(postcode)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3`
    const forecast = await fetchJson(weatherUrl)
    const daily = forecast.daily || {}
    const times = Array.isArray(daily.time) ? daily.time.slice(0, 3) : []
    const days = times.map((d, i) => ({
      day: formatForecastDay(d),
      label: weatherLabel(daily.weathercode?.[i]),
      max: Math.round(Number(daily.temperature_2m_max?.[i] ?? 0)),
      min: Math.round(Number(daily.temperature_2m_min?.[i] ?? 0)),
      rain: Math.round(Number(daily.precipitation_probability_max?.[i] ?? 0))
    }))

    if(!days.length) throw new Error('Geen forecast data')

    weatherCache[postcode] = {
      fetchedAt: Date.now(),
      days,
      place: coords.place,
      country: coords.country
    }
  } catch (err) {
    weatherCache[postcode] = {
      fetchedAt: Date.now(),
      error: true
    }
  } finally {
    weatherLoading.delete(postcode)
    render()
  }
}

function renderPaddockWeather(paddock, isVisible){
  const visibilityClass = isVisible ? ' is-visible' : ''
  const rawPostcode = (paddock.postcode || '').trim()
  if(!rawPostcode){
    return `<div class="paddock-weather paddock-weather-empty${visibilityClass}">Geen postcode voor forecast</div>`
  }

  const postcodeKey = rawPostcode.toUpperCase()
  const cached = weatherCache[postcodeKey]
  const isFresh = !!cached && (Date.now() - cached.fetchedAt) < WEATHER_TTL_MS

  if((!cached || !isFresh) && !weatherLoading.has(postcodeKey)){
    loadWeatherForPostcode(postcodeKey)
  }

  if(!cached || !isFresh){
    return `<div class="paddock-weather paddock-weather-loading${visibilityClass}">3-daagse forecast laden...</div>`
  }

  if(cached.error){
    return `<div class="paddock-weather paddock-weather-error${visibilityClass}">Geen forecast beschikbaar voor postcode ${postcodeKey}</div>`
  }

  return `<div class="paddock-weather${visibilityClass}">${cached.days.map(day => `<div class="weather-day"><strong>${day.day}</strong><small>${day.label}</small><small>${day.max}° / ${day.min}°</small><small>${day.rain}% regen</small></div>`).join('')}</div>`
}

function ensureDefaultStal(){
  if(state.paddocks.length > 0) return
  const paddockId = uid()
  const zoneId = uid()
  state.paddocks.push({
    id: paddockId,
    name: 'Stal',
    postcode: '',
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
      postcode: typeof p.postcode === 'string' ? p.postcode : '',
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
    state.history = Array.isArray(saved.history) ? saved.history.map(h => ({
      id: h.id || uid(),
      ts: h.ts ?? Date.now(),
      entity: h.entity || 'systeem',
      message: h.message || ''
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

function formatDateTime(timestamp){
  return new Date(timestamp).toLocaleString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
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

function addHistory(entity, message){
  state.history.unshift({
    id: uid(),
    ts: Date.now(),
    entity,
    message
  })
  if(state.history.length > 400){
    state.history = state.history.slice(0, 400)
  }
}

function sheepNamesList(sheepItems){
  return sheepItems.map(s => s.tag).join(', ')
}

function exportData(){
  const exportState = {
    ...state,
    history: Array.isArray(state.history) ? state.history.slice(0, 100) : []
  }
  const json = JSON.stringify(exportState, null, 2)
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
        postcode: typeof p.postcode === 'string' ? p.postcode : '',
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
      state.history = Array.isArray(parsed.history) ? parsed.history.map(h => ({
        id: h.id || uid(),
        ts: h.ts ?? Date.now(),
        entity: h.entity || 'systeem',
        message: h.message || ''
      })) : []
      ensureDefaultStal()
      updateZoneEmptyStates()
      addHistory('systeem', 'Gegevens geïmporteerd uit bestand')
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
  const historyList = document.getElementById('history-list')
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
          <button type="button" class="sheep-tag-edit-button" data-id="${s.id}" aria-label="Naam wijzigen voor ${s.tag}">${s.tag}</button>
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

  if(historyList){
    historyList.classList.toggle('is-scrollable', state.history.length > 5)
    historyList.innerHTML = state.history.length
      ? state.history.map(h => `<div class="history-item"><span class="history-meta">${formatDateTime(h.ts)} - ${h.entity}</span><span class="history-message">${h.message}</span></div>`).join('')
      : '<div class="empty">Nog geen wijzigingen geregistreerd.</div>'
  }

  if(sheepPaddockModal && sheepZoneModal){
    setSheepModalDefaultSelection()
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
  const isExpanded = expandedPaddockId === p.id
  const isWeatherExpanded = expandedWeatherPaddocks.has(p.id)
  const sheepCount = state.sheep.filter(s => s.paddockId === p.id).length
  const sheepLabel = sheepCount === 1 ? 'schaap' : 'schapen'
  const paddockPostcode = (p.postcode || '').trim()
  const weatherHtml = renderPaddockWeather(p, isWeatherExpanded)
  const canDeletePaddock = !isStalPaddock(p)
  return `<div class="card" data-id="${p.id}" ${isExpanded ? 'data-expanded="true"' : ''}>
    <div class="card-header" data-paddock-id="${p.id}" style="cursor:pointer;user-select:none">
      <div class="card-header-main">
        <strong>${p.name}</strong>
        ${paddockPostcode ? `<span class="paddock-postcode">${paddockPostcode}</span>` : ''}
        <span class="paddock-sheep-count">${sheepCount} ${sheepLabel}</span>
      </div>
      <div class="card-header-actions">
        <span class="badge">${p.zones.length} zone(s)</span>
        <button type="button" class="weather-toggle-button" data-paddock-id="${p.id}">Weervoorspelling</button>
        <button type="button" class="paddock-edit-button" data-paddock-id="${p.id}" aria-label="Weide bewerken">✎</button>
        ${canDeletePaddock ? `<button type="button" class="paddock-delete-button" data-paddock-id="${p.id}" aria-label="Weide verwijderen">−</button>` : ''}
      </div>
    </div>
    ${weatherHtml}
    <div class="zone-list" ${isExpanded ? '' : 'style="display:none"'}>
      ${p.zones.map(z => {
        const sheepInZone = state.sheep.filter(s => s.paddockId === p.id && s.zoneId === z.id)
        const sheepCount = sheepInZone.length
        const status = z.emptySince ? `Leeg sinds ${daysSince(z.emptySince)} dagen` : `Bezet${sheepCount ? ` (${sheepCount})` : ''}`
        const bulkMoveButton = sheepCount > 1 ? `<button type="button" class="zone-bulk-move-button" data-paddock-id="${p.id}" data-zone-id="${z.id}">Verplaats alle dieren</button>` : ''
        const sheepLabel = sheepCount
          ? `<div class="zone-sheep-list${sheepCount > 6 ? ' is-scrollable' : ''}">${sheepInZone.map(s => `<button type="button" class="zone-sheep-link" data-sheep-id="${s.id}" aria-label="Verplaats ${s.tag}">${sheepIcon()}${s.tag}</button>`).join('')}</div>${bulkMoveButton}`
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

function setSheepModalDefaultSelection(){
  const sheepPaddockModal = document.getElementById('sheep-paddock-modal')
  const sheepZoneModal = document.getElementById('sheep-zone-modal')
  if(!sheepPaddockModal || !sheepZoneModal) return

  populatePaddockSelect(sheepPaddockModal)

  const stalPaddock = state.paddocks.find(p => isStalPaddock(p))
  const selectedPaddock = stalPaddock || state.paddocks[0]
  if(!selectedPaddock){
    sheepZoneModal.innerHTML = '<option value="">Kies eerst een weide</option>'
    sheepZoneModal.disabled = true
    return
  }

  sheepPaddockModal.value = selectedPaddock.id
  if(selectedPaddock.zones.length){
    sheepZoneModal.innerHTML = `<option value="" selected disabled hidden>Kies zone</option>` + selectedPaddock.zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('')
    sheepZoneModal.disabled = false

    const stalZone = selectedPaddock.zones.find(z => typeof z.name === 'string' && z.name.toLowerCase() === 'stal')
    if(stalZone){
      sheepZoneModal.value = stalZone.id
    } else if(selectedPaddock.zones.length === 1){
      sheepZoneModal.value = selectedPaddock.zones[0].id
    } else {
      sheepZoneModal.value = ''
    }
  } else {
    sheepZoneModal.innerHTML = '<option value="">Geen zones beschikbaar</option>'
    sheepZoneModal.disabled = true
  }
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
let activeEditSheepId = null
let activeEditPaddockId = null
let pendingZoneDeletion = null
let pendingPaddockDeletion = null
let pendingZoneBulkMove = null

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
    const sheepToMove = state.sheep.filter(s => s.paddockId === sourcePaddockId && s.zoneId === sourceZoneId)
    const movedNames = sheepNamesList(sheepToMove)
    state.sheep.forEach(s => {
      if(s.paddockId === sourcePaddockId && s.zoneId === sourceZoneId){
        s.paddockId = target.paddockId
        s.zoneId = target.zoneId
        s.lastUpdated = Date.now()
      }
    })
    sourcePaddock.zones = sourcePaddock.zones.filter(z => z.id !== sourceZoneId)
    addHistory('zone', `Zone ${sourcePaddock.name} / ${sourceZone.name} verwijderd en schapen automatisch verplaatst naar ${paddockName(target.paddockId)} / ${zoneName(target.paddockId, target.zoneId)}: ${movedNames}`)
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

function availableBulkMoveTargetZones(targetPaddockId, sourcePaddockId, sourceZoneId){
  const targetPaddock = getPaddock(targetPaddockId)
  if(!targetPaddock) return []
  return targetPaddock.zones.filter(z => !(targetPaddockId === sourcePaddockId && z.id === sourceZoneId))
}

function availableBulkMoveTargetPaddocks(sourcePaddockId, sourceZoneId){
  return state.paddocks.filter(p => availableBulkMoveTargetZones(p.id, sourcePaddockId, sourceZoneId).length > 0)
}

function populateZoneBulkMoveTargets(selectedPaddockId){
  const paddockSelect = document.getElementById('zone-bulk-move-target-paddock-modal')
  const zoneSelect = document.getElementById('zone-bulk-move-target-zone-modal')
  const submitBtn = document.getElementById('zone-bulk-move-submit')
  if(!paddockSelect || !zoneSelect || !pendingZoneBulkMove) return

  const targetPaddocks = availableBulkMoveTargetPaddocks(pendingZoneBulkMove.sourcePaddockId, pendingZoneBulkMove.sourceZoneId)
  if(!targetPaddocks.length){
    paddockSelect.innerHTML = '<option value="">Geen doelweides beschikbaar</option>'
    paddockSelect.disabled = true
    zoneSelect.innerHTML = '<option value="">Geen doelzones beschikbaar</option>'
    zoneSelect.disabled = true
    if(submitBtn) submitBtn.disabled = true
    return
  }

  const effectivePaddockId = selectedPaddockId || targetPaddocks[0].id
  paddockSelect.disabled = false
  paddockSelect.innerHTML = `<option value="" disabled hidden>Kies weide</option>` + targetPaddocks.map(p => `<option value="${p.id}"${p.id === effectivePaddockId ? ' selected' : ''}>${p.name}</option>`).join('')

  const zones = availableBulkMoveTargetZones(effectivePaddockId, pendingZoneBulkMove.sourcePaddockId, pendingZoneBulkMove.sourceZoneId)
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

function openZoneBulkMoveModal(sourcePaddockId, sourceZoneId){
  const sourcePaddock = getPaddock(sourcePaddockId)
  const sourceZone = getZone(sourcePaddockId, sourceZoneId)
  if(!sourcePaddock || !sourceZone) return

  const sheepInZone = state.sheep.filter(s => s.paddockId === sourcePaddockId && s.zoneId === sourceZoneId)
  if(!sheepInZone.length){
    alert('Geen schapen in deze zone om te verplaatsen.')
    return
  }

  const targetPaddocks = availableBulkMoveTargetPaddocks(sourcePaddockId, sourceZoneId)
  if(!targetPaddocks.length){
    alert('Geen doelzone beschikbaar. Voeg eerst een extra zone of weide met zone toe.')
    return
  }

  pendingZoneBulkMove = { sourcePaddockId, sourceZoneId }

  const sourceLabel = document.getElementById('zone-bulk-move-source-name')
  const sheepLabel = document.getElementById('zone-bulk-move-sheep-count')
  if(sourceLabel){
    sourceLabel.textContent = `${sourcePaddock.name} / ${sourceZone.name}`
  }
  if(sheepLabel){
    sheepLabel.textContent = `${sheepInZone.length} schaap${sheepInZone.length === 1 ? '' : 'en'}`
  }

  populateZoneBulkMoveTargets(targetPaddocks[0].id)
  openModal('zone-bulk-move-modal')
}

function closeZoneBulkMoveModal(){
  pendingZoneBulkMove = null
  closeModal('zone-bulk-move-modal')
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
    const sheepToMove = state.sheep.filter(s => s.paddockId === sourcePaddockId)
    const movedNames = sheepNamesList(sheepToMove)
    state.sheep.forEach(s => {
      if(s.paddockId === sourcePaddockId){
        s.paddockId = target.paddockId
        s.zoneId = target.zoneId
        s.lastUpdated = Date.now()
      }
    })
    state.paddocks = state.paddocks.filter(p => p.id !== sourcePaddockId)
    if(expandedPaddockId === sourcePaddockId) expandedPaddockId = null
    addHistory('weide', `Weide ${sourcePaddock.name} verwijderd en schapen automatisch verplaatst naar ${paddockName(target.paddockId)} / ${zoneName(target.paddockId, target.zoneId)}: ${movedNames}`)
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

function openEditSheepTagModal(sheepId){
  const sheep = state.sheep.find(s => s.id === sheepId)
  if(!sheep) return
  activeEditSheepId = sheepId

  const input = document.getElementById('sheep-tag-edit-input')
  if(input){
    input.value = sheep.tag
  }

  const modal = document.getElementById('sheep-tag-edit-modal')
  if(modal){
    modal.classList.remove('hidden')
    modal.setAttribute('aria-hidden', 'false')
  }

  if(input){
    input.focus()
    input.select()
  }
}

function closeEditSheepTagModal(){
  activeEditSheepId = null
  closeModal('sheep-tag-edit-modal')
}

function openEditPaddockModal(paddockId){
  const paddock = getPaddock(paddockId)
  if(!paddock) return
  activeEditPaddockId = paddockId

  const nameInput = document.getElementById('paddock-edit-name')
  const postcodeInput = document.getElementById('paddock-edit-postcode')
  if(nameInput){
    nameInput.value = paddock.name || ''
    nameInput.disabled = isStalPaddock(paddock)
  }
  if(postcodeInput){
    postcodeInput.value = paddock.postcode || ''
  }

  openModal('paddock-edit-modal')
}

function closeEditPaddockModal(){
  activeEditPaddockId = null
  closeModal('paddock-edit-modal')
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
  state.history = []
  expandedPaddockId = null
  expandedWeatherPaddocks.clear()
  ensureDefaultStal()
  addHistory('systeem', 'Alle gegevens gewist')
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

document.getElementById('paddock-edit-modal-close')?.addEventListener('click', closeEditPaddockModal)
document.getElementById('paddock-edit-modal-backdrop')?.addEventListener('click', closeEditPaddockModal)

document.getElementById('sheep-modal-close')?.addEventListener('click', () => closeModal('sheep-modal'))
document.getElementById('sheep-modal-backdrop')?.addEventListener('click', () => closeModal('sheep-modal'))

document.getElementById('sheep-tag-edit-modal-close')?.addEventListener('click', closeEditSheepTagModal)
document.getElementById('sheep-tag-edit-modal-backdrop')?.addEventListener('click', closeEditSheepTagModal)

document.getElementById('zone-modal-close')?.addEventListener('click', () => closeModal('zone-modal'))
document.getElementById('zone-modal-backdrop')?.addEventListener('click', () => closeModal('zone-modal'))

document.getElementById('zone-delete-move-modal-close')?.addEventListener('click', closeZoneDeleteMoveModal)
document.getElementById('zone-delete-move-modal-backdrop')?.addEventListener('click', closeZoneDeleteMoveModal)

document.getElementById('zone-bulk-move-modal-close')?.addEventListener('click', closeZoneBulkMoveModal)
document.getElementById('zone-bulk-move-modal-backdrop')?.addEventListener('click', closeZoneBulkMoveModal)

document.getElementById('paddock-delete-move-modal-close')?.addEventListener('click', closePaddockDeleteMoveModal)
document.getElementById('paddock-delete-move-modal-backdrop')?.addEventListener('click', closePaddockDeleteMoveModal)

document.getElementById('move-modal-form')?.addEventListener('submit', e => {
  e.preventDefault()
  if(!activeMoveSheepId) return
  const paddockId = document.getElementById('move-paddock-modal').value
  const zoneId = document.getElementById('move-zone-modal').value
  const sheep = state.sheep.find(x => x.id === activeMoveSheepId)
  if(!sheep || !paddockId) return
  const fromLabel = `${paddockName(sheep.paddockId)}${sheep.zoneId ? ' / ' + zoneName(sheep.paddockId, sheep.zoneId) : ''}`
  const toLabel = `${paddockName(paddockId)}${zoneId ? ' / ' + zoneName(paddockId, zoneId) : ''}`
  sheep.paddockId = paddockId
  sheep.zoneId = zoneId || null
  sheep.lastUpdated = Date.now()
  addHistory('schaap', `${sheep.tag} verplaatst van ${fromLabel} naar ${toLabel}`)
  save(); render(); closeModal('move-modal')
})

document.getElementById('paddock-modal-form')?.addEventListener('submit', e => {
  e.preventDefault()
  const name = document.getElementById('paddock-modal-name').value.trim()
  const postcode = document.getElementById('paddock-modal-postcode').value.trim()
  if(!name) return
  state.paddocks.push({id:uid(), name, postcode, zones: []})
  addHistory('weide', `Weide ${name} toegevoegd`)
  document.getElementById('paddock-modal-name').value = ''
  document.getElementById('paddock-modal-postcode').value = ''
  save(); render(); closeModal('paddock-modal')
})

document.getElementById('paddock-edit-form')?.addEventListener('submit', e => {
  e.preventDefault()
  if(!activeEditPaddockId) return

  const paddock = getPaddock(activeEditPaddockId)
  if(!paddock) return

  const nameInput = document.getElementById('paddock-edit-name')
  const postcodeInput = document.getElementById('paddock-edit-postcode')
  const nextName = nameInput ? nameInput.value.trim() : ''
  const nextPostcode = postcodeInput ? postcodeInput.value.trim() : ''

  const beforeName = paddock.name
  const beforePostcode = paddock.postcode || ''

  if(!isStalPaddock(paddock) && nextName){
    paddock.name = nextName
  }
  paddock.postcode = nextPostcode

  if(beforeName !== paddock.name || beforePostcode !== paddock.postcode){
    addHistory('weide', `Weide bijgewerkt: ${beforeName} -> ${paddock.name}${beforePostcode !== paddock.postcode ? `, postcode ${beforePostcode || '-'} -> ${paddock.postcode || '-'}` : ''}`)
  }

  save(); render(); closeEditPaddockModal()
})

document.getElementById('sheep-modal-form')?.addEventListener('submit', e => {
  e.preventDefault()
  const tag = document.getElementById('sheep-modal-tag').value.trim()
  const paddockId = document.getElementById('sheep-paddock-modal').value
  const zoneId = document.getElementById('sheep-zone-modal').value
  if(!tag || !paddockId) return
  state.sheep.push({id:uid(), tag, paddockId, zoneId: zoneId || null, lastUpdated: Date.now()})
  addHistory('schaap', `${tag} toegevoegd in ${paddockName(paddockId)}${zoneId ? ' / ' + zoneName(paddockId, zoneId) : ''}`)
  document.getElementById('sheep-modal-tag').value = ''
  document.getElementById('sheep-zone-modal').value = ''
  save(); render(); closeModal('sheep-modal')
})

document.getElementById('sheep-tag-edit-form')?.addEventListener('submit', e => {
  e.preventDefault()
  if(!activeEditSheepId) return

  const input = document.getElementById('sheep-tag-edit-input')
  const nextTag = input ? input.value.trim() : ''
  if(!nextTag) return

  const sheep = state.sheep.find(s => s.id === activeEditSheepId)
  if(!sheep) return

  const previousTag = sheep.tag
  sheep.tag = nextTag
  sheep.lastUpdated = Date.now()
  addHistory('schaap', `Naam gewijzigd van ${previousTag} naar ${nextTag}`)
  save(); render(); closeEditSheepTagModal()
})

const sheepPaddockModal = document.getElementById('sheep-paddock-modal')
if(sheepPaddockModal){
  sheepPaddockModal.addEventListener('change', () => {
    const sheepZoneModal = document.getElementById('sheep-zone-modal')
    const selectedPaddock = getPaddock(sheepPaddockModal.value)
    if(selectedPaddock && selectedPaddock.zones.length){
      sheepZoneModal.innerHTML = `<option value="" selected disabled hidden>Kies zone</option>` + selectedPaddock.zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('')
      sheepZoneModal.disabled = false
      if(selectedPaddock.zones.length === 1){
        sheepZoneModal.value = selectedPaddock.zones[0].id
      }
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

const zoneBulkMoveTargetPaddockModal = document.getElementById('zone-bulk-move-target-paddock-modal')
if(zoneBulkMoveTargetPaddockModal){
  zoneBulkMoveTargetPaddockModal.addEventListener('change', () => {
    populateZoneBulkMoveTargets(zoneBulkMoveTargetPaddockModal.value)
  })
}

const zoneBulkMoveTargetZoneModal = document.getElementById('zone-bulk-move-target-zone-modal')
if(zoneBulkMoveTargetZoneModal){
  zoneBulkMoveTargetZoneModal.addEventListener('change', () => {
    const submitBtn = document.getElementById('zone-bulk-move-submit')
    if(submitBtn){
      submitBtn.disabled = !zoneBulkMoveTargetZoneModal.value
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
  const sourceZone = getZone(pendingZoneDeletion.sourcePaddockId, pendingZoneDeletion.sourceZoneId)
  const sheepToMove = state.sheep.filter(s => s.paddockId === pendingZoneDeletion.sourcePaddockId && s.zoneId === pendingZoneDeletion.sourceZoneId)
  const movedNames = sheepNamesList(sheepToMove)

  state.sheep.forEach(s => {
    if(s.paddockId === pendingZoneDeletion.sourcePaddockId && s.zoneId === pendingZoneDeletion.sourceZoneId){
      s.paddockId = targetPaddockId
      s.zoneId = targetZoneId
      s.lastUpdated = Date.now()
    }
  })

  sourcePaddock.zones = sourcePaddock.zones.filter(z => z.id !== pendingZoneDeletion.sourceZoneId)
  addHistory('zone', `Zone ${sourcePaddock.name} / ${sourceZone ? sourceZone.name : 'Onbekend'} verwijderd en schapen verplaatst naar ${paddockName(targetPaddockId)} / ${zoneName(targetPaddockId, targetZoneId)}: ${movedNames}`)
  save(); render(); closeZoneDeleteMoveModal()
})

document.getElementById('paddock-delete-move-form')?.addEventListener('submit', e => {
  e.preventDefault()
  if(!pendingPaddockDeletion) return

  const targetPaddockId = document.getElementById('paddock-delete-target-paddock-modal').value
  const targetZoneId = document.getElementById('paddock-delete-target-zone-modal').value
  if(!targetPaddockId || !targetZoneId) return
  const sourcePaddock = getPaddock(pendingPaddockDeletion.sourcePaddockId)
  const sheepToMove = state.sheep.filter(s => s.paddockId === pendingPaddockDeletion.sourcePaddockId)
  const movedNames = sheepNamesList(sheepToMove)

  state.sheep.forEach(s => {
    if(s.paddockId === pendingPaddockDeletion.sourcePaddockId){
      s.paddockId = targetPaddockId
      s.zoneId = targetZoneId
      s.lastUpdated = Date.now()
    }
  })

  state.paddocks = state.paddocks.filter(p => p.id !== pendingPaddockDeletion.sourcePaddockId)
  if(expandedPaddockId === pendingPaddockDeletion.sourcePaddockId) expandedPaddockId = null
  addHistory('weide', `Weide ${sourcePaddock ? sourcePaddock.name : 'Onbekend'} verwijderd en schapen verplaatst naar ${paddockName(targetPaddockId)} / ${zoneName(targetPaddockId, targetZoneId)}: ${movedNames}`)
  save(); render(); closePaddockDeleteMoveModal()
})

document.getElementById('zone-bulk-move-form')?.addEventListener('submit', e => {
  e.preventDefault()
  if(!pendingZoneBulkMove) return

  const targetPaddockId = document.getElementById('zone-bulk-move-target-paddock-modal').value
  const targetZoneId = document.getElementById('zone-bulk-move-target-zone-modal').value
  if(!targetPaddockId || !targetZoneId) return
  if(targetPaddockId === pendingZoneBulkMove.sourcePaddockId && targetZoneId === pendingZoneBulkMove.sourceZoneId) return
  const sourcePaddock = getPaddock(pendingZoneBulkMove.sourcePaddockId)
  const sourceZone = getZone(pendingZoneBulkMove.sourcePaddockId, pendingZoneBulkMove.sourceZoneId)
  const sheepToMove = state.sheep.filter(s => s.paddockId === pendingZoneBulkMove.sourcePaddockId && s.zoneId === pendingZoneBulkMove.sourceZoneId)
  const movedNames = sheepNamesList(sheepToMove)

  state.sheep.forEach(s => {
    if(s.paddockId === pendingZoneBulkMove.sourcePaddockId && s.zoneId === pendingZoneBulkMove.sourceZoneId){
      s.paddockId = targetPaddockId
      s.zoneId = targetZoneId
      s.lastUpdated = Date.now()
    }
  })

  addHistory('schaap', `${movedNames} verplaatst van ${sourcePaddock ? sourcePaddock.name : 'Onbekend'} / ${sourceZone ? sourceZone.name : 'Onbekend'} naar ${paddockName(targetPaddockId)} / ${zoneName(targetPaddockId, targetZoneId)}`)
  save(); render(); closeZoneBulkMoveModal()
})

document.getElementById('move-modal-close')?.addEventListener('click', () => closeModal('move-modal'))

document.getElementById('move-modal-backdrop')?.addEventListener('click', () => closeModal('move-modal'))

document.getElementById('sheep-list')?.addEventListener('click', e => {
  const editButton = e.target.closest('.sheep-tag-edit-button')
  if(editButton){
    openEditSheepTagModal(editButton.dataset.id)
    return
  }

  const button = e.target.closest('.move-button')
  if(button){
    openMoveModal(button.dataset.id)
    return
  }

  const deleteButton = e.target.closest('.sheep-delete-button')
  if(deleteButton){
    const sheepId = deleteButton.dataset.id
    if(!sheepId) return
    const sheep = state.sheep.find(s => s.id === sheepId)
    state.sheep = state.sheep.filter(s => s.id !== sheepId)
    if(sheep){
      addHistory('schaap', `${sheep.tag} verwijderd uit ${paddockName(sheep.paddockId)}${sheep.zoneId ? ' / ' + zoneName(sheep.paddockId, sheep.zoneId) : ''}`)
    }
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

  const zoneBulkMoveButton = e.target.closest('.zone-bulk-move-button')
  if(zoneBulkMoveButton){
    const sourcePaddockId = zoneBulkMoveButton.dataset.paddockId
    const sourceZoneId = zoneBulkMoveButton.dataset.zoneId
    if(!sourcePaddockId || !sourceZoneId) return
    openZoneBulkMoveModal(sourcePaddockId, sourceZoneId)
    return
  }

  const weatherToggleButton = e.target.closest('.weather-toggle-button')
  if(weatherToggleButton){
    const paddockId = weatherToggleButton.dataset.paddockId
    if(!paddockId) return
    if(expandedWeatherPaddocks.has(paddockId)){
      expandedWeatherPaddocks.delete(paddockId)
    } else {
      expandedWeatherPaddocks.add(paddockId)
    }
    render()
    return
  }

  const editPaddockButton = e.target.closest('.paddock-edit-button')
  if(editPaddockButton){
    const paddockId = editPaddockButton.dataset.paddockId
    if(!paddockId) return
    openEditPaddockModal(paddockId)
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
    if(expandedPaddockId === paddockId) expandedPaddockId = null
    expandedWeatherPaddocks.delete(paddockId)
    addHistory('weide', `Weide ${paddock.name} verwijderd`)
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
    addHistory('zone', `Zone ${paddock.name} / ${zone.name} verwijderd`)
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
  if(expandedPaddockId === paddockId){
    expandedPaddockId = null
  } else {
    expandedPaddockId = paddockId
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
  addHistory('zone', `Zone ${zoneName} toegevoegd in weide ${paddock.name}`)
  save(); render(); closeModal('zone-modal')
})

load(); render()
