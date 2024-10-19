import { writable } from 'svelte/store';

export let operatorst = writable();

export let editable = writable(false);

export let view = writable('group');

export let nlang = writable('en'); //native lang

export let langs = writable('en'); //current lang

export let llang = writable('en'); //learning

export let pswd = writable();

export let audioCtx = writable();

export let posterst = writable();

export let msg_user = writable();

export let msg_oper = writable();

export let signal = writable();

export let wss = writable();

export let dicts = writable();

export let credentials = writable();

export let users = writable({});

export let call_but_status = writable('inactive');

export let ice_conf = writable();

// export let pool = writable();

export let rtcPool_st = writable();
rtcPool_st.set({ user: {}, operator: {} });

export let lesson = writable({ visible: true });

export let click_call_func = writable();

export let dc_oper = writable();
export let dc_user = writable();
export let dc_oper_state = writable();
export let dc_user_state = writable();

export let share_mode = writable(false);

export let user_placeholder = writable();

export let muted = writable(true);

// export let audioCtx = writable();

export let showBottomAppBar = writable(true);

export let OnCheckQU = writable();
