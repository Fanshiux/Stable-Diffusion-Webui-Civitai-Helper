'use strict'

// send msg to python side by filling a hidden text box
// then will click a button to trigger an action
// msg is an object, not a string, will be stringify in this function
function send_ch_py_msg(msg) {
    let js_msg_txtbox = $el('#ch_js_msg_txtbox textarea')
    if (js_msg_txtbox && msg) {
        // fill to msg box
        js_msg_txtbox.value = JSON.stringify(msg)
        updateInput(js_msg_txtbox)
    }
}

// get msg from python side from a hidden textbox
// normally this is an old msg, need to wait for a new msg
function get_ch_py_msg() {
    let py_msg_txtbox = $el('#ch_py_msg_txtbox textarea')
    return py_msg_txtbox?.value
}

// get msg from python side from a hidden textbox
// it will try once in every sencond, until it reach the max try times
function get_new_ch_py_msg(max_count = 9) {
    return new Promise((resolve, reject) => {
        let msg_txtbox = $el('#ch_py_msg_txtbox textarea')
        let new_msg = ''
        let count = 0, interval = setInterval(() => {
            if (msg_txtbox && msg_txtbox.value) {
                new_msg = msg_txtbox.value
            }
            if (new_msg || ++count > max_count) {
                clearInterval(interval)
                // clear msg in both sides (client & server)
                msg_txtbox.value = ''
                updateInput(msg_txtbox)
                if (new_msg) {
                    resolve(new_msg)
                } else {
                    reject('')
                }
            }
        }, 333)
    })
}

function getActivePrompt(neg) {
    let tab = uiCurrentTab.innerText
    if (neg) tab += '_neg'
    return get_uiCurrentTabContent().querySelector(`#${tab}_prompt textarea`)
}

// button's click function
async function open_model_url(event, model_type, search_term) {
    event.stopPropagation()
    event.preventDefault()
    let btn = app.getElementById('ch_js_open_url_btn')
    if (!btn) return

    send_ch_py_msg({
        action: 'open_url',
        search_term,
        model_type
    })
    try {
        btn.click();
        let new_py_msg = await get_new_ch_py_msg();
        if (new_py_msg) {
            const py_msg_json = JSON.parse(new_py_msg);
            if (py_msg_json && py_msg_json.content && py_msg_json.content.url) {
                open(py_msg_json.content.url, '_blank')
            }
        }
    } catch (e) { }
}

function add_trigger_words(event, model_type, search_term) {
    // Get hidden components of extension
    let btn = app.getElementById('ch_js_add_trigger_words_btn')
    if (!btn) return

    // Fill the message box
    send_ch_py_msg({
        'action': 'add_trigger_words',
        'model_type': model_type,
        'search_term': search_term,
        'prompt': getActivePrompt().value,
        'neg_prompt': ''
    })

    // Click the hidden button
    btn.click()

    event.stopPropagation()
    event.preventDefault()
}

function use_preview_prompt(event, model_type, search_term) {
    // Get hidden components of extension
    let btn = app.getElementById('ch_js_use_preview_prompt_btn')
    if (!btn) return

    // Fill the message box
    send_ch_py_msg({
        'action': 'use_preview_prompt',
        'model_type': model_type,
        'search_term': search_term,
        'prompt': getActivePrompt().value,
        'neg_prompt': getActivePrompt(1).value
    })

    // Click the hidden button
    btn.click()

    event.stopPropagation()
    event.preventDefault()
}

async function delete_model(event, model_type, search_term) {
    event.stopPropagation()
    if (!confirm(`Confirm delete model: "${search_term}"?`)) return

    // Get hidden components of extension
    let btn = app.getElementById('ch_js_delete_model_btn')
    if (!btn) return

    // Fill the message box
    send_ch_py_msg({
        'action': 'delete_model',
        'model_type': model_type,
        'search_term': search_term
    })

    // Click the hidden button
    btn.click()

    // Check response msg from python
    let new_py_msg = await get_new_ch_py_msg()

    // Check msg
    if (new_py_msg) {
        let py_msg_json = JSON.parse(new_py_msg)
        if (py_msg_json && py_msg_json.result) {
            alert('Model deleted successfully!!')
            let card = event.target.closest('.card')
            card.parentNode.removeChild(card)
        }
    }
};

// download model's new version into SD at python side
function ch_dl_model_new_version(event, model_path, version_id, download_url) {
    // must confirm before downloading
    let dl_confirm = '\nConfirm to download.\n\nCheck Download Model Section\'s log and console log for detail.'
    if (!confirm(dl_confirm)) return

    //get hidden components of extension
    let btn = app.getElementById('ch_js_dl_model_new_version_btn')
    if (!btn) return

    // fill to msg box
    send_ch_py_msg({
        action: 'dl_model_new_version',
        model_path: model_path,
        version_id: version_id,
        download_url: download_url
    })

    //click hidden button
    btn.click()

    event.stopPropagation()
    event.preventDefault()
}

const model_type_mapping = {
    'textual_inversion': 'ti',
    'hypernetworks': 'hyper',
    'checkpoints': 'ckp',
    'lora': 'lora'
}

function createAdditionalBtn(props) {
    let el = createEl('a','civitai-helper-action')
    Object.assign(el, props)
    el.setAttribute('onclick', props.onclick)
    return el
}

// add just one model_type cards buttons
function update_tab_cards(model_type, container) {
    model_type = model_type_mapping[model_type]
    if (!model_type) return

    for (let card of container.children) {
        // additional node
        let additional_node = card.querySelector('.actions .additional')
        if (additional_node.childElementCount >= 4) {
            // console.log('buttons all ready added, just quit')
            return
        }

        // get search_term
        let search_term = card.querySelector('.actions .search_term')?.innerText
        if (!search_term) {
            continue
        }

        let btns = [{
            innerHTML: '🌐',
            title: 'Open this model\'s civitai url',
            onclick: 'open_model_url(event, \'' + model_type + '\', \'' + search_term + '\')'
        }, {
            innerHTML: '💡',
            title: 'Add trigger words to prompt',
            onclick: 'add_trigger_words(event, \'' + model_type + '\', \'' + search_term + '\')'
        }, {
            innerHTML: '🪞',
            title: 'Use prompt from preview image',
            onclick: 'use_preview_prompt(event, \'' + model_type + '\', \'' + search_term + '\')'
        }, {
            innerHTML: '🗑️',
            title: 'Delete model',
            onclick: 'delete_model(event, \'' + model_type + '\', \'' + search_term + '\')',
        }]

        for (let btn of btns) {
            additional_node.appendChild(createAdditionalBtn(btn))
        }
    }
}

function addHelperBtn(tab_prefix) {
    let tab_nav = $el(`#${tab_prefix}_extra_tabs > .tab-nav`)
    if (!tab_nav) {
        return setTimeout(() => addHelperBtn, 999, tab_prefix)
    }
    // function createEl(tag, clazz, attrs, style) {
    let scan_btn = createEl('label', 'gradio-button custom-button tool', {
        title: 'Download missing model info and preview image',
        innerText: '🖼️'
    })
    scan_btn.setAttribute('for', 'ch_scan_model_civitai_btn')
    tab_nav.appendChild(scan_btn)
}


function listenToToggleBtn(tab_prefix) {
    $el(`#${tab_prefix}_extra_tabs .tab-nav`).addEventListener('click', e => {
        let el = e.target
        let model_type = el.innerText.trim().replaceAll(' ', '_').toLowerCase()
        if (el.tagName != 'BUTTON' || !model_type_mapping.hasOwnProperty(model_type)) return
        let container_id = `${tab_prefix}_${model_type}_cards`
        let n = 5, timer = setInterval(() => {
            update_tab_cards(model_type, $id(container_id))
            if (--n == 0) clearInterval(timer)
        }, 800)
    })
}

// listen to refresh buttons' click event
// check and re-add buttons back on
function listenToRefreshBtn(tab_prefix) {
    $id(tab_prefix + '_extra_refresh').addEventListener('click', e => {
        let model_type = e.target.closest('.tab-nav').querySelector('button.selected').innerText.replaceAll(' ', '_').toLowerCase()
        checkPeriodically(tab_prefix, model_type)
    })
}

// check cards number change, and re-craete buttons
function checkPeriodically(tab_prefix, model_type) {
    let container_id = `#${tab_prefix}_${model_type}_cards`
    // we only wait 5s, after that we assumed that DOM will never change
    let n = 5
    function check() {
        let len = $el(container_id + ' .additional').childElementCount
        // console.info('checkPeriodically, cards: ', len)
        if (len >= 4 && n-- > 0) {
            setTimeout(check, 1000)
            return
        }
        update_tab_cards(model_type, $el(container_id))
    }
    setTimeout(check, 1500)
}

// fast pasete civitai model url and trigger model info loading
async function check_clipboard() {
    let text = await navigator.clipboard.readText()
    if (text.startsWith('https://civitai.com/models/')) {
        let el = document.querySelector('#model_download_url_txt')
        let textarea = el.querySelector('textarea')
        if (textarea.value == text) {
            let version = $id('ch_dl_all_ckb').previousElementSibling.querySelector('input')
            if (version.value) {
                $id('ch_download_btn')?.click()
            }
            return
        }
        textarea.value = text
        updateInput(textarea)
        el.querySelector('button').click()
    }
}

// shotcut key event listener
addEventListener('keydown', e => {
    if (uiCurrentTab.innerText != 'Civitai Helper') return
    switch (e.key) {
        case 'x': check_clipboard()
    }
})

onUiLoaded(() => {
    let tab_prefixes = ['txt2img', 'img2img']
    for (let tab_prefix of tab_prefixes) {
        listenToRefreshBtn(tab_prefix)
        listenToToggleBtn(tab_prefix)
        addHelperBtn(tab_prefix)
    }
})
