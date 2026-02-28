const STEPS = 10;
const ANIM_LENGTH = 600; // milliseconds
const CHARS = `1234567890-=!@#$%^*()_+qwertyuiop[]\\QWERTYUIOP{}|asdfghjkl;ASDFGHJKL:zxcvbnm,./ZXCVBNM?`
const MAX_WIDTH = 80;

let TEXT = "";
let LINKS = [];
let wrapped = [], display_text = [];
let animating = false;

// TEXT -> 2d arr of chars (padded w/ spaces, one link per link char)
function generate_wrapped(width, min_height) {
	let text_width = Math.min(MAX_WIDTH, width-3);
	let link_idx = 0;
	const wrapped = TEXT
		.replace(new RegExp(`([^\n]{1,${text_width}})(?: |$)`, "gm"), "$1\n") // wrap
		.replace(/\n\n/g, "\n")
		.split("\n")
		.map(line => {
			const padded_line = line.padEnd(width-1, " ").padStart(width+1, " ");
			const split_line = padded_line.split("");
			if (link_idx >= LINKS.length) return split_line;

			// Add in links; each link in LINKS is a single word
			let substr_start = 0;
			let regex_out;
			while (regex_out = (new RegExp(
					`(\\s|\\b)${RegExp.escape(LINKS[link_idx].text)}(?:\\s|\\b)`
				)).exec(padded_line.substring(substr_start))) {
				let idx_in_line = regex_out.index + regex_out[1].length;
				let length = LINKS[link_idx].text.length;
				// If the next link is part of this link and it's not the end of the
				// line, add one to the length to make the space a link also
				if (link_idx < LINKS.length - 1 &&
					LINKS[link_idx+1].href === LINKS[link_idx].href &&
					(/[^\s]+ [^\s]/.test(padded_line.substring(substr_start)))) {
					length++;
				}
				// Add links to each char in the word
				for (let i = 0; i < length; i++) {
					split_line[substr_start+idx_in_line+i] =
						`<a href="${LINKS[link_idx].href}">` +
						split_line[substr_start+idx_in_line+i] +
						"</a>";
				}
				substr_start += idx_in_line + LINKS[link_idx].text.length;
				link_idx++;
				if (link_idx >= LINKS.length) break;
			}
			return split_line;
		});
	// Add empty lines if necessary
	if (wrapped.length < min_height) {
		document.querySelector("#js-body").style.height = "100vh";
		const empty_lines = new Array(min_height - wrapped.length)
			.fill()
			.map(_ => new Array(width + 1).fill(" "));
		return wrapped.concat(empty_lines);
	} else {
		document.querySelector("#js-body").style.height = "";
	}
	return wrapped;
}

// Switch chars to/from random chars. wrapped_idx has a number for each char
// that describes which step to change on. Write to the page after.
function animation_step(step, wrapped_idx) {
	for (let i = 0; i < Math.min(wrapped_idx.length, display_text.length, wrapped.length); i++) {
		wrapped_idx[i].forEach((count, j) => {
			if (count === step && display_text[i][j] === wrapped[i][j])
				display_text[i][j] = CHARS.charAt(Math.random()*CHARS.length);
			else if (count > step)
				display_text[i][j] = wrapped[i][j];
		})
	}
	document.querySelector("#js-body").innerHTML = display_text
		.map(line => line.join("")).join("\n");
}

// Run on resize. Pass new values to wrapped because size changed (or text
// changed)
function resize() {
	const one_char = document.querySelector("#one-char");
	const width = Math.floor(window.innerWidth / one_char.clientWidth);
	wrapped = generate_wrapped(
		Math.floor(window.innerWidth / one_char.clientWidth),
		Math.floor(window.innerHeight / one_char.clientHeight) + 1
	);
}
function resize_and_display() {
	resize();
	display_text = JSON.parse(JSON.stringify(wrapped));
	animation_step(0, []);
}

// Given a doc (either current or one parsed from a loaded page), set TEXT/LINKS
function set_text(doc = document) {
	TEXT = doc.querySelector("#text").textContent
		.replace(/\t/g, "        ");
	LINKS = Array.from(doc.querySelectorAll("#text a"))
		.map(a =>
			a.innerText.split(" ").map(word => ({
				text: word,
				href: a.origin === window.location.origin && a.href.endsWith("html") ?
					`javascript:load_page('${a.pathname}')` :
					a.href
			}))
		).flat();
}

// Load a page on the same site (fetch, parse its dom, use its text)
// Adds page to history as well, if not by back action.
async function load_page(url, pop = false) {
	if (animating) return;
	animating = true;
	const res_promise = fetch(url);

	// animate before await
	const wrapped_idx = wrapped
		.map(line => line.map(_ => Math.floor(Math.random()*STEPS) + 1));
	for (let step = 1; step <= STEPS; step++) {
		const sleep = new Promise(res =>
			setTimeout(() => res(), ANIM_LENGTH/(STEPS*2)));
		animation_step(step, wrapped_idx);
		await sleep;
	}

	// get request
	const res = await res_promise;
	if (!pop)
		window.history.pushState({url}, "", window.location.origin + url);
	if (res.ok) {
		// change TEXT and links
		const html_text = await res.text();
		const parser = new DOMParser();
		const doc = parser.parseFromString(html_text, "text/html");
		set_text(doc);
		document.title = doc.title;
	} else {
		TEXT = `\nError loading ${url} w/ status ${res.status}.\n\n\nback`;
		LINKS = [
			{text: "back", href: "javascript:history.back()"}
		];
	}
	resize();

	// animate back
	for (let step = STEPS; step >= 0; step--) {
		const sleep = new Promise(res =>
			setTimeout(() => res(), ANIM_LENGTH/(STEPS*2)));
		animation_step(step, wrapped_idx);
		await sleep;
	}
	// this is the only way I found to make transitioning between smaller/bigger
	// sites reliable \/
	resize_and_display();

	animating = false;
}

window.addEventListener("resize", resize_and_display);
window.addEventListener("load", () => {
	set_text();
	resize_and_display();
	document.querySelector("#text").style.display = "none";
});
// Happens when user presses back button
window.addEventListener("popstate", e => {
	load_page(window.location.pathname, true);
});
