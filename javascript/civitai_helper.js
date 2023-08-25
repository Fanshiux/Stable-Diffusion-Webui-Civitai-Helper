'use strict'

function ch_gradio_version() {
    let versions = app.querySelector('#footer .versions')
    if (!versions) return ''

    let m = versions.innerText.match(/gradio: ([\d.]+)/)
    return m ? m[0] : ''
}

// send msg to python side by filling a hidden text box
// then will click a button to trigger an action
// msg is an object, not a string, will be stringify in this function
function send_ch_py_msg(msg) {
    // console.log("run send_ch_py_msg")
    let js_msg_txtbox = app.querySelector('#ch_js_msg_txtbox textarea')
    if (js_msg_txtbox && msg) {
        // fill to msg box
        js_msg_txtbox.value = JSON.stringify(msg)
        js_msg_txtbox.dispatchEvent(new Event('input'))
    }
}

// get msg from python side from a hidden textbox
// normally this is an old msg, need to wait for a new msg
function get_ch_py_msg() {
    const py_msg_txtbox = app.querySelector('#ch_py_msg_txtbox textarea')
    if (py_msg_txtbox && py_msg_txtbox.value) {
        console.log('Get py_msg_txtbox value:', py_msg_txtbox.value)
        return py_msg_txtbox.value
    }
}

// get msg from python side from a hidden textbox
// it will try once in every sencond, until it reach the max try times
const get_new_ch_py_msg = (max_count = 9) => new Promise((resolve, reject) => {
    let msg_txtbox = app.querySelector('#ch_py_msg_txtbox textarea')
    let find_msg = false
    let new_msg = ''
    let count = 0, interval = setInterval(() => {
        count++
        if (!msg_txtbox) {
            msg_txtbox = app.querySelector('#ch_py_msg_txtbox textarea')
        }
        if (msg_txtbox && msg_txtbox.value) {
            // console.log('find py_msg_txtbox, value: ', msg_txtbox.value)
            new_msg = msg_txtbox.value
            find_msg = new_msg !== ''
        }

        if (find_msg) {
            // clear msg in both sides
            msg_txtbox.value = ''
            msg_txtbox.dispatchEvent(new Event('input'))

            resolve(new_msg)
            clearInterval(interval)
        } else if (count > max_count) {
            // clear msg in both sides
            msg_txtbox.value = ''
            msg_txtbox.dispatchEvent(new Event('input'))

            reject('')
            clearInterval(interval)
        }
    }, 333)
})

function getActivePrompt() {
    return get_uiCurrentTabContent().querySelector(`#${uiCurrentTab.innerText}_prompt textarea`)
}

function getActiveNegativePrompt() {
    return get_uiCurrentTabContent().querySelector(`#${uiCurrentTab.innerText}_neg_prompt textarea`)
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
        model_type,
        prompt: '',
        neg_prompt: ''
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
    } catch (e) {}
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
        'neg_prompt': getActiveNegativePrompt().value
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
    console.log('start ch_dl_model_new_version')

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
    'lora': 'lora',
    'lycoris': 'lycoris'
}

function createAdditionalBtn(btnProps) {
    let el = document.createElement('a')
    Object.assign(el, btnProps)
    el.setAttribute('onclick', btnProps.onclick)
    el.className = 'civitai-helper-action'
    el.href = 'javascript:void(0)'
    return el
}

// add just one model_type cards buttons
function update_tab_cards(model_type, container) {

    model_type = model_type_mapping[model_type]

    for (let card of container.children) {
        // additional node
        let additional_node = card.querySelector('.actions .additional')
        if (additional_node.childElementCount >= 4) {
            console.log('buttons all ready added, just quit')
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

// add all model_type cards buttons by tab_prefix
function update_all_tab_cards(tab_prefix) {
    let model_type_list = ['textual_inversion', 'hypernetworks', 'checkpoints', 'lora', 'lycoris']
    for (let model_type of model_type_list) {
        let container_id = [tab_prefix, model_type, 'cards'].join('_')
        let container = document.getElementById(container_id)
        container && update_tab_cards(model_type, container)
    }
}

function add_helper_btn(tab_prefix) {
    let tab_id = tab_prefix + '_extra_tabs'
    // get Refresh button under toolbar
    let extra_network_refresh_btn = app.getElementById(tab_prefix + '_extra_refresh')
    if (!extra_network_refresh_btn) {
        console.log('can not get extra network refresh button for ' + tab_id)
        return
    }

    // add refresh button to toolbar
    let ch_refresh = document.createElement('button')
    ch_refresh.innerHTML = '🔄️'
    ch_refresh.title = 'Refresh Civitai Helper\'s additional buttons'
    ch_refresh.className = 'lg secondary gradio-button'
    ch_refresh.style.fontSize = '2em'
    ch_refresh.onclick = () => update_all_tab_cards(tab_prefix)

    extra_network_refresh_btn.parentNode.appendChild(ch_refresh)
}

// listen to "Extra Networks" toggle button's click event,
// then initialiy add all buttons, only trigger once,
// after that all updates are trigger by refresh button click.
function listenToToggleBtn(tab_prefix) {
    document.getElementById(tab_prefix + '_extra_networks').addEventListener('click', () => {
        // wait UI updates
        let n = 0, timer = setInterval(() => {
            update_all_tab_cards(tab_prefix)
            if (++n === 6) clearInterval(timer)
        }, 600)
    }, { once: true })
}

// listen to refresh buttons' click event
// check and re-add buttons back on
function listenToRefreshBtn(tab_prefix) {
    document.getElementById(tab_prefix + '_extra_refresh').addEventListener('click', e => {
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
        console.info('checkPeriodically, cards: ', len)
        if (len >= 4 && n-- > 0) {
            setTimeout(check, 1000)
            return
        }
        update_all_tab_cards(tab_prefix)
        // update_tab_cards(model_type, app.querySelector(container_id))
    }
    setTimeout(check, 1500)
}

// fast pasete civitai model url and trigger model info loading
async function check_clipboard() {
    let text = await navigator.clipboard.readText()
    if (text.startsWith('https://civitai.com/models/')) {
        let el = document.querySelector('#model_download_url_txt')
        let textarea = el.querySelector('textarea')
        textarea.value = text
        updateInput(textarea)
        el.querySelector('button').click()
    }
}

// shotcut key event listener
addEventListener('keydown', e => {
    if (e.key == 'x' && uiCurrentTab.innerText == 'Civitai Helper') {
        check_clipboard()
    }
})

function helperInit() {
    let tab_prefixes = ['txt2img', 'img2img']
    for (let tab_prefix of tab_prefixes) {

        // add refresh button to extra network's toolbar
        // add_helper_btn(tab_prefix);

        listenToToggleBtn(tab_prefix);

        listenToRefreshBtn(tab_prefix);
    }
}

onUiLoaded(() => {

    // get gradio version
    let gradio_version = ch_gradio_version()
    console.log(gradio_version)

    helperInit()

})
