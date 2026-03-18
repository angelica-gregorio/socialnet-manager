// js/app.js
// ================================================================
// Section 1: Supabase Client Initialization
// ================================================================
const { createClient } = supabase

const SUPABASE_URL             = 'https://zyaawbfqarkpvsmtmkml.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable__Vs5ph57WTcGeiE0q7dRtQ_xAN5oZMk'

// Initialize Supabase client — use `db` for ALL queries
const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

// ================================================================
// Section 2: Application State
// ================================================================
let currentProfileId = null

// ================================================================
// Section 3: Helper Functions
// ================================================================

function setStatus(message, isError = false) {
    const bar    = document.getElementById('status-message')
    const footer = document.getElementById('status-bar')
    bar.textContent = message
    footer.classList.toggle('error', isError)
}

function clearCentrePanel() {
    document.getElementById('profile-pic').src = 'resources/images/default.png'
    document.getElementById('profile-name').textContent = 'No Profile Selected'
    document.getElementById('profile-status').textContent = '—'
    document.getElementById('profile-quote').textContent = '—'
    document.getElementById('friends-list').innerHTML = ''
    currentProfileId = null
    // Remove active highlight
    document.querySelectorAll('#profile-list .profile-item')
        .forEach(el => el.classList.remove('active'))
}

/**
 * Normalises a picture input so the user can type just "tesla.png"
 * instead of the full "resources/images/tesla.png" path.
 */
function normalisePicturePath(input) {
    const val = input.trim()
    if (!val) return val
    // Already a full path or URL — leave it alone
    if (val.startsWith('resources/') || val.startsWith('http')) return val
    // Strip any leading slashes or partial paths the user may have typed
    const filename = val.split('/').pop()
    return `resources/images/${filename}`
}

/**
 * Generates a small circular SVG avatar showing the first letter of the name.
 * Returns a data-URI string usable as an <img> src.
 */
function getInitialAvatar(name) {
    const initial = (name || '?').trim().charAt(0).toUpperCase()
    // Pick a hue based on char code for variety
    const hue = (initial.charCodeAt(0) * 37) % 360
    const bg  = `hsl(${hue},45%,28%)`
    const fg  = `hsl(${hue},60%,80%)`
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="16" fill="${bg}"/>
        <text x="16" y="21" text-anchor="middle" font-size="15" font-family="Inter,sans-serif" font-weight="600" fill="${fg}">${initial}</text>
    </svg>`
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

function displayProfile(profile, friends = []) {
    document.getElementById('profile-pic').src =
        profile.picture || 'resources/images/default.png'
    document.getElementById('profile-name').textContent = profile.name
    document.getElementById('profile-status').textContent =
        profile.status || '(no status)'
    document.getElementById('profile-quote').textContent =
        profile.quote || '(no quote)'
    currentProfileId = profile.id
    renderFriendsList(friends)
    setStatus(`Displaying profile: ${profile.name}.`)
}

function renderFriendsList(friends) {
    const list = document.getElementById('friends-list')
    list.innerHTML = ''
    if (friends.length === 0) {
        list.innerHTML = '<p class="empty-state">No friends yet.</p>'
        return
    }
    friends.forEach(f => {
        const div = document.createElement('div')
        div.className = 'friend-entry'
        div.textContent = f.name
        list.appendChild(div)
    })
}

// ================================================================
// Section 4: CRUD Functions
// ================================================================

async function loadProfileList() {
    try {
        const { data, error } = await db          // ← FIX: was `supabase`
            .from('profiles')
            .select('id, name, picture')
            .order('name', { ascending: true })
        if (error) throw error

        const container = document.getElementById('profile-list')
        container.innerHTML = ''

        if (data.length === 0) {
            container.innerHTML =
                '<p class="text-muted small fst-italic p-2">No profiles found.</p>'
            return
        }

        data.forEach(profile => {
            const row = document.createElement('div')
            row.className = 'profile-item'
            row.dataset.id = profile.id

            // Thumbnail: real picture or generated initial avatar
            const thumbSrc = profile.picture || getInitialAvatar(profile.name)
            const isInitial = !profile.picture

            const thumb = document.createElement('img')
            thumb.className = 'profile-thumb' + (isInitial ? ' profile-thumb--initial' : '')
            thumb.src = thumbSrc
            thumb.alt = ''

            const nameSpan = document.createElement('span')
            nameSpan.textContent = profile.name

            row.appendChild(thumb)
            row.appendChild(nameSpan)
            row.addEventListener('click', () => selectProfile(profile.id))
            container.appendChild(row)
        })
    } catch (err) {
        setStatus(`Error loading profiles: ${err.message}`, true)
    }
}

async function selectProfile(profileId) {
    try {
        document.querySelectorAll('#profile-list .profile-item')
            .forEach(el => el.classList.toggle('active', el.dataset.id === profileId))

        const { data: profile, error: profileError } = await db   // ← FIX
            .from('profiles')
            .select('*')
            .eq('id', profileId)
            .single()
        if (profileError) throw profileError

        const { data: friends1, error: e1 } = await db            // ← FIX
            .from('friends')
            .select('profiles!friends_friend_id_fkey(name)')
            .eq('profile_id', profileId)
        if (e1) throw e1

        const { data: friends2, error: e2 } = await db            // ← FIX
            .from('friends')
            .select('profiles!friends_profile_id_fkey(name)')
            .eq('friend_id', profileId)
        if (e2) throw e2

        const friends = [
            ...friends1.map(f => ({ name: f.profiles.name })),
            ...friends2.map(f => ({ name: f.profiles.name }))
        ]
        displayProfile(profile, friends)
    } catch (err) {
        setStatus(`Error selecting profile: ${err.message}`, true)
    }
}

async function addProfile() {
    const nameInput = document.getElementById('input-name')
    const name = nameInput.value.trim()
    if (!name) {
        setStatus('Error: Name field is empty. Please enter a name.', true)
        return
    }
    try {
        const { data, error } = await db                           // ← FIX
            .from('profiles')
            .insert({ name })
            .select()
            .single()
        if (error) {
            if (error.code === '23505') {
                setStatus(`Error: A profile named "${name}" already exists.`, true)
            } else {
                throw error
            }
            return
        }
        nameInput.value = ''
        await loadProfileList()
        await selectProfile(data.id)
        setStatus(`Profile "${name}" created successfully.`)
    } catch (err) {
        setStatus(`Error adding profile: ${err.message}`, true)
    }
}

async function lookUpProfile() {
    const query = document.getElementById('input-lookup').value.trim()
    if (!query) {
        setStatus('Error: Search field is empty. Please enter a name to search.', true)
        return
    }
    try {
        const { data, error } = await db                           // ← FIX
            .from('profiles')
            .select('id, name')
            .ilike('name', `%${query}%`)
            .order('name', { ascending: true })
            .limit(1)
        if (error) throw error
        if (data.length === 0) {
            setStatus(`No profile found matching "${query}".`, true)
            clearCentrePanel()
            return
        }
        await selectProfile(data[0].id)
    } catch (err) {
        setStatus(`Error looking up profile: ${err.message}`, true)
    }
}

async function deleteProfile() {
    if (!currentProfileId) {
        setStatus('Error: No profile is selected. Click a profile in the list first.', true)
        return
    }
    const name = document.getElementById('profile-name').textContent
    if (!window.confirm(`Delete the profile for "${name}"? This cannot be undone.`)) {
        setStatus('Deletion cancelled.')
        return
    }
    try {
        const { error } = await db                                 // ← FIX
            .from('profiles')
            .delete()
            .eq('id', currentProfileId)
        if (error) throw error
        clearCentrePanel()
        await loadProfileList()
        setStatus(`Profile "${name}" deleted. Friend relationships removed automatically.`)
    } catch (err) {
        setStatus(`Error deleting profile: ${err.message}`, true)
    }
}

async function changeStatus() {
    if (!currentProfileId) {
        setStatus('Error: No profile is selected.', true)
        return
    }
    const newStatus = document.getElementById('input-status').value.trim()
    if (!newStatus) {
        setStatus('Error: Status field is empty.', true)
        return
    }
    try {
        const { error } = await db                                 // ← FIX
            .from('profiles')
            .update({ status: newStatus })
            .eq('id', currentProfileId)
        if (error) throw error
        document.getElementById('profile-status').textContent = newStatus
        document.getElementById('input-status').value = ''
        setStatus('Status updated.')
    } catch (err) {
        setStatus(`Error updating status: ${err.message}`, true)
    }
}

async function changePicture() {
    if (!currentProfileId) {
        setStatus('Error: No profile is selected.', true)
        return
    }
    
    const fileInput = document.getElementById('input-picture')
    const file = fileInput.files[0]

    if (!file) {
        setStatus('Error: Please select an image file first.', true)
        return
    }

    setStatus('Uploading image... Please wait.')

    try {
        // 1. Pack the file into FormData
        const formData = new FormData()
        formData.append('file', file)

        // 2. Send the file to your Vercel API endpoint
        // NOTE: Adjust the URL path if your Vercel function is routed differently
        const uploadRes = await fetch('/api/upload-avatar', {
            method: 'POST',
            body: formData
        })

        if (!uploadRes.ok) throw new Error('Failed to upload image to server.')
        
        // Vercel Blob returns the saved object, which includes the public 'url'
        const blobData = await uploadRes.json()
        const newPictureUrl = blobData.url 

        // 3. Update Supabase with the new Vercel Blob URL
        const { error } = await db                                 
            .from('profiles')
            .update({ picture: newPictureUrl })
            .eq('id', currentProfileId)
            
        if (error) throw error

        // 4. Update the UI
        document.getElementById('profile-pic').src = newPictureUrl
        
        const listRow = document.querySelector(`#profile-list .profile-item[data-id="${currentProfileId}"]`)
        if (listRow) {
            const thumb = listRow.querySelector('.profile-thumb')
            if (thumb) {
                thumb.src = newPictureUrl
                thumb.classList.remove('profile-thumb--initial')
            }
        }
        
        fileInput.value = '' // Clear the file input
        setStatus('Picture updated successfully.')
        
    } catch (err) {
        setStatus(`Error updating picture: ${err.message}`, true)
    }
}

async function changeQuote() {
    if (!currentProfileId) {
        setStatus('Error: No profile is selected.', true)
        return
    }
    const newQuote = document.getElementById('input-quote').value.trim()
    if (!newQuote) {
        setStatus('Error: Quote field is empty.', true)
        return
    }
    try {
        const { error } = await db                                 // ← FIX
            .from('profiles')
            .update({ quote: newQuote })
            .eq('id', currentProfileId)
        if (error) throw error
        document.getElementById('profile-quote').textContent = newQuote
        document.getElementById('input-quote').value = ''
        setStatus('Quote updated.')
    } catch (err) {
        setStatus(`Error updating quote: ${err.message}`, true)
    }
}

// ================================================================
// Section 5: Friends Management
// ================================================================

async function addFriend() {
    if (!currentProfileId) {
        setStatus('Error: No profile is selected.', true)
        return
    }
    const friendName = document.getElementById('input-friend').value.trim()
    if (!friendName) {
        setStatus('Error: Friend name field is empty.', true)
        return
    }
    try {
        const { data: found, error: findError } = await db         // ← FIX
            .from('profiles')
            .select('id, name')
            .ilike('name', friendName)
            .limit(1)
        if (findError) throw findError

        if (found.length === 0) {
            setStatus(`Error: No profile named "${friendName}" exists. Add that profile first.`, true)
            return
        }

        const friendId = found[0].id
        if (friendId === currentProfileId) {
            setStatus('Error: A profile cannot be friends with itself.', true)
            return
        }

        const { error: insertError } = await db                    // ← FIX
            .from('friends')
            .insert({ profile_id: currentProfileId, friend_id: friendId })

        if (insertError) {
            if (insertError.code === '23505') {
                setStatus(`"${friendName}" is already in the friends list.`, true)
            } else {
                throw insertError
            }
            return
        }

        document.getElementById('input-friend').value = ''
        await selectProfile(currentProfileId)
        setStatus(`"${found[0].name}" added as a friend.`)
    } catch (err) {
        setStatus(`Error adding friend: ${err.message}`, true)
    }
}

async function removeFriend() {
    if (!currentProfileId) {
        setStatus('Error: No profile is selected.', true)
        return
    }
    const friendName = document.getElementById('input-remove-friend').value.trim()
    if (!friendName) {
        setStatus('Error: Friend name field is empty.', true)
        return
    }
    try {
        const { data: found, error: findError } = await db         // ← FIX
            .from('profiles')
            .select('id, name')
            .ilike('name', friendName)
            .limit(1)
        if (findError) throw findError

        if (found.length === 0) {
            setStatus(`Error: No profile named "${friendName}" exists.`, true)
            return
        }

        const friendId = found[0].id

        const { error: deleteError } = await db                    // ← FIX
            .from('friends')
            .delete()
            .eq('profile_id', currentProfileId)
            .eq('friend_id', friendId)
        if (deleteError) throw deleteError

        document.getElementById('input-remove-friend').value = ''
        await selectProfile(currentProfileId)
        setStatus(`"${found[0].name}" removed from friends list.`)
    } catch (err) {
        setStatus(`Error removing friend: ${err.message}`, true)
    }
}

// ================================================================
// Section 6: Event Listener Setup
// ================================================================

document.addEventListener('DOMContentLoaded', async () => {

    // Left panel
    document.getElementById('btn-add')
        .addEventListener('click', addProfile)
    document.getElementById('btn-lookup')
        .addEventListener('click', lookUpProfile)
    document.getElementById('btn-delete')
        .addEventListener('click', deleteProfile)

    // Right panel
    document.getElementById('btn-status')
        .addEventListener('click', changeStatus)
    document.getElementById('btn-quote')
        .addEventListener('click', changeQuote)
    document.getElementById('btn-picture')
        .addEventListener('click', changePicture)
    document.getElementById('btn-add-friend')
        .addEventListener('click', addFriend)
    document.getElementById('btn-remove-friend')
        .addEventListener('click', removeFriend)

    // Exit button
    document.getElementById('btn-exit')
        .addEventListener('click', () => {
            if (!window.close()) setStatus('To exit, close this browser tab.')
        })

    // Enter-key shortcuts
    document.getElementById('input-name')
        .addEventListener('keydown', e => { if (e.key === 'Enter') addProfile() })
    document.getElementById('input-lookup')
        .addEventListener('keydown', e => { if (e.key === 'Enter') lookUpProfile() })
    document.getElementById('input-status')
        .addEventListener('keydown', e => { if (e.key === 'Enter') changeStatus() })
    document.getElementById('input-quote')
        .addEventListener('keydown', e => { if (e.key === 'Enter') changeQuote() })
    document.getElementById('input-picture')
        .addEventListener('keydown', e => { if (e.key === 'Enter') changePicture() })
    document.getElementById('input-friend')
        .addEventListener('keydown', e => { if (e.key === 'Enter') addFriend() })
    document.getElementById('input-remove-friend')
        .addEventListener('keydown', e => { if (e.key === 'Enter') removeFriend() })

    // Initial data load
    await loadProfileList()
    setStatus('Ready. Select a profile from the list or add a new one.')
})