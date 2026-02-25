const STEPS = 10;
const ANIM_LENGTH = 1000; // milliseconds
const CHARS = `1234567890-=!@#$%^*()_+qwertyuiop[]\\QWERTYUIOP{}|asdfghjkl;ASDFGHJKL:zxcvbnm,./ZXCVBNM?`

let TEXT = "";
let LINKS = [];
let wrapped = [], display_text = [];
let animating = false;

// TEXT -> 2d arr of chars (padded w/ spaces, copied 2x)
function generate_wrapped(width, min_height) {
	const links = LINKS.slice();
	const wrapped = TEXT
		.replace(new RegExp(`([^\n]{1,${width-2}})(?: |$)`, "gm"), "$1\n") // wrap
		.split("\n")
		.map(line => {
			const padded_line = line.padEnd(width, " ").padStart(width + 1, " ");
			const split_line = padded_line.split("");
			links.forEach((link, link_num) => {
				let link_index = -1;
				if ((link_index = padded_line.indexOf(link.text)) > 0) {
					for (let i = 0; i < link.text.length; i++) {
						split_line[link_index+i] =
							`<a href="${link.href}">` +
							split_line[link_index+i] +
							"</a>";
					}
					links.splice(link_num, 1);
				}
			});
			return split_line;
		});
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
function animation_step(step, wrapped_idx) {
	wrapped_idx.forEach((line, i) =>
		line.forEach((count, j) => {
			if (count === step && display_text[i][j] === wrapped[i][j])
				display_text[i][j] = CHARS.charAt(Math.random()*CHARS.length);
			else if (count > step)
				display_text[i][j] = wrapped[i][j];
		})
	);
	document.querySelector("#js-body").innerHTML = display_text.map(line => line.join("")).join("\n");
}

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

function set_text(doc = document) {
	TEXT = doc.querySelector("#text").textContent
		.trim()
		.replace(/\t/g, "");
	LINKS = Array.from(doc.querySelectorAll("#text a"))
		.map(a => ({
			text: a.innerText,
			href: a.origin === window.location.origin ?
				`javascript:load_page('${a.pathname}')` :
				a.href
		}));
}

async function load_page(url, pop = false) {
	if (animating) return;
	animating = true;
	const res_promise = fetch(url);

	// animate before await
	const wrapped_idx = wrapped
		.map(line => line.map(_ => Math.floor(Math.random()*STEPS) + 1));
	for (let step = 1; step <= STEPS; step++) {
		const sleep = new Promise(res => setTimeout(() => res(), ANIM_LENGTH/(STEPS*2)));
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
		TEXT = `Error loading ${url} w/ status ${res.status}.\nback`;
		LINKS = [
			{text: "back", href: "javascript:history.back()"}
		];
	}
	resize();

	// animate back
	for (let step = STEPS; step >= 0; step--) {
		const sleep = new Promise(res => setTimeout(() => res(), ANIM_LENGTH/(STEPS*2)));
		animation_step(step, wrapped_idx);
		await sleep;
	}
	if (display_text.length < wrapped.length) {
		display_text = display_text.concat(wrapped.slice(display_text.length))
	}

	animating = false;
}

window.addEventListener("resize", resize_and_display);
window.addEventListener("load", () => {
	set_text();
	resize_and_display();
	document.querySelector("#text").style.display = "none";
});
window.addEventListener("popstate", e => {
	load_page(window.location.pathname, true);
});
