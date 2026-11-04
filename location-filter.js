/* fmdx-servermap-location-filter.js
 *
 * Location filter for the FM-DX server directory (NoobishSVK/fm-dx-servermap,
 * the site behind https://servers.fmdx.org/).
 *
 * What it does:
 *  - Adds a "Country" dropdown to the receiver-list panel, populated
 *    dynamically from the fetched /api dataset (never hardcoded), sorted
 *    A-Z, with per-country server counts.
 *  - Adds a free-text search that matches name, city, country name,
 *    description and URL (the stock search only matched name/url/etc).
 *  - Country AND search combine. A "Clear filters" button resets both.
 *  - A live result count ("Showing 38 of 562 servers") is exposed through
 *    role="status" so screen readers announce it.
 *
 * What it does NOT do:
 *  - It never touches the map, the markers, or the "discover a new server"
 *    button. Discover keeps picking a random marker from the map-visible
 *    set exactly as before. (Optional follow-up: see the scope doc for the
 *    one-line change that would make discover draw from the filtered list.)
 *  - It does not fake US-state drill-down. Country filtering is 100%
 *    data-driven (every /api entry has a `country` ISO code). The search box
 *    additionally understands US state *names* ("michigan" also matches a
 *    standalone "MI" token in a server name/city) via a small public lookup
 *    table -- see US_STATE_ALIASES. That is deterministic reference data,
 *    not fragile name parsing, and it is clearly marked as US-only.
 *
 * Install: drop this file next to index.html and add
 *     <script src="location-filter.js"></script>
 * after helpers.js in index.html, then apply the wire-in edits in
 * fmdx-servermap-location-filter-scope.md (a few guarded one-liners in
 * maps.js -- every edit falls back to the old behaviour if this script
 * is missing).
 *
 * The pure functions (buildCountryIndex / matchesFilter / applyFilters)
 * have no DOM dependency and are exported for Node so the logic can be
 * unit-tested against the real dataset.
 */
(function (global) {
    'use strict';

    /* ------------------------------------------------------------------
     * Pure logic (no DOM) -- safe to require() in Node for testing.
     * ------------------------------------------------------------------ */

    // Auxiliary, US-only: full state name -> 2-letter abbreviation.
    // Used ONLY to let a typed state name ("michigan") also match the
    // standalone abbreviation token ("MI") in a server name or city.
    // Deterministic public reference data, not name parsing.
    var US_STATE_ALIASES = {
        alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR',
        california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE',
        florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
        illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS',
        kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
        massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
        mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE',
        nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
        'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
        'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
        pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
        'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
        vermont: 'VT', virginia: 'VA', washington: 'WA',
        'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
        'district of columbia': 'DC'
    };

    // Lowercase + diacritic folding, so "miedzyzdroje" also finds
    // "Miêdzyzdroje", and so the state-abbreviation alias below cannot
    // false-positive on a diacritic word boundary (in non-Unicode regex
    // mode "ê" counts as a word boundary, which wrongly matched "Mi"
    // inside "Miêdzyzdroje" before folding was added).
    function norm(v) {
        return String(v === null || v === undefined ? '' : v)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    // Build a sorted [{code, name, count}] index from the dataset.
    // `country` is the ISO code (lowercase in the /api, e.g. "de");
    // entries missing countryName fall back to the uppercased code.
    function buildCountryIndex(tuners) {
        var byCode = {};
        tuners.forEach(function (t) {
            var code = norm(t.country) || 'unknown';
            if (!byCode[code]) {
                byCode[code] = {
                    code: code,
                    name: t.countryName || code.toUpperCase(),
                    count: 0
                };
            }
            byCode[code].count++;
        });
        var list = Object.keys(byCode).map(function (k) { return byCode[k]; });
        list.sort(function (a, b) { return a.name.localeCompare(b.name); });
        return list;
    }

    // Does one tuner object match the current filter state?
    // state = { country: 'de'|'', query: 'michigan'|'' }
    function matchesFilter(tuner, state) {
        state = state || {};
        var country = norm(state.country);
        var q = norm(state.query).trim();

        if (country && norm(tuner.country) !== country) {
            return false;
        }
        if (!q) {
            return true;
        }

        var haystack = [tuner.name, tuner.city, tuner.countryName, tuner.desc, tuner.url, tuner.country]
            .map(norm).join(' ');
        if (haystack.indexOf(q) !== -1) {
            return true;
        }

        // US state-name alias: "michigan" also matches a standalone "MI"
        // token in the name/city (word boundaries, so "Miami" is safe).
        var alias = US_STATE_ALIASES[q];
        if (alias) {
            var label = [tuner.name, tuner.city].map(norm).join(' ');
            var re = new RegExp('\\b' + alias.toLowerCase() + '\\b');
            if (re.test(label)) {
                return true;
            }
        }
        return false;
    }

    function applyFilters(tuners, state) {
        return tuners.filter(function (t) { return matchesFilter(t, state); });
    }

    /* ------------------------------------------------------------------
     * DOM wiring (browser only). Operates ONLY on the receiver-list panel
     * (.tuner rows); the map, markers and discover button are untouched.
     * ------------------------------------------------------------------ */

    var currentState = { country: '', query: '' };
    var tunerData = [];
    var initialized = false;
    var pendingCountry = '';

    function injectStyles() {
        if (document.getElementById('lf-styles')) {
            return;
        }
        var css = [
            '.lf-filter-bar{padding:0 12px 10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;}',
            '.lf-filter-bar label{color:#ccc;font-size:13px;}',
            '.lf-filter-bar select{height:40px;background:#2228;border:none;border-radius:10px;padding:0 12px;color:#ccc;max-width:100%;}',
            '.lf-filter-bar select:focus{background:#222c;}',
            '.lf-clear{background:#333a;border:none;border-radius:10px;padding:10px 14px;color:#ccc;cursor:pointer;}',
            '.lf-clear:hover{background:#444c;}',
            '#lf-count{padding:0 12px 8px;margin:0;color:#999;font-size:13px;}',
            '.lf-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;}'
        ].join('\n');
        var style = document.createElement('style');
        style.id = 'lf-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function buildUI(countries, total) {
        // Accessible label for the stock search input (it only had a placeholder).
        var searchInput = document.getElementById('tuner-search');
        if (searchInput && !document.querySelector('label[for="tuner-search"]')) {
            var searchLabel = document.createElement('label');
            searchLabel.setAttribute('for', 'tuner-search');
            searchLabel.className = 'lf-sr-only';
            searchLabel.textContent = 'Search receivers by name, city or description';
            searchInput.parentNode.insertBefore(searchLabel, searchInput);
        }

        var bar = document.createElement('div');
        bar.className = 'lf-filter-bar';

        var countryLabel = document.createElement('label');
        countryLabel.setAttribute('for', 'lf-country');
        countryLabel.textContent = 'Country';

        var select = document.createElement('select');
        select.id = 'lf-country';

        var all = document.createElement('option');
        all.value = '';
        all.textContent = 'All countries (' + total + ')';
        select.appendChild(all);

        countries.forEach(function (c) {
            var opt = document.createElement('option');
            opt.value = c.code;
            opt.textContent = c.name + ' (' + c.count + ')';
            select.appendChild(opt);
        });

        var clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.id = 'lf-clear';
        clearBtn.className = 'lf-clear';
        clearBtn.textContent = 'Clear filters';

        bar.appendChild(countryLabel);
        bar.appendChild(select);
        bar.appendChild(clearBtn);

        var count = document.createElement('p');
        count.id = 'lf-count';
        count.setAttribute('role', 'status'); // aria-live polite: SRs announce the count

        var searchWrap = document.querySelector('.panel-content-all .search');
        if (searchWrap && searchWrap.parentNode) {
            searchWrap.parentNode.insertBefore(bar, searchWrap);
            searchWrap.parentNode.insertBefore(count, searchWrap.nextSibling);
        } else {
            // Fallback: append to the panel content if the expected markup moved.
            var panel = document.querySelector('.panel-content-all');
            if (panel) {
                panel.appendChild(bar);
                panel.appendChild(count);
            }
        }

        select.addEventListener('change', function () {
            setCountry(select.value);
        });
        clearBtn.addEventListener('click', function () {
            clear();
        });
    }

    // Show/hide list rows from the current state; mirrors the status
    // counters and the "no receivers" message the stock filterTuners()
    // maintained, and updates the aria-live result count.
    function applyDomFilter() {
        if (!initialized || typeof $ === 'undefined') {
            return;
        }
        var visible = 0;
        var counts = {};
        $('.tuner-list .tuner').each(function () {
            var t = tunerData[$(this).data('index')];
            var show = !!t && matchesFilter(t, currentState);
            $(this).toggle(show);
            if (show) {
                visible++;
                var s = t.status;
                counts[s] = (counts[s] || 0) + 1;
            }
        });
        $('.no-content').toggle(visible === 0);
        $('.status0-count').text(counts[0] || 0);
        $('.status1-count').text(counts[1] || 0);
        $('.status2-count').text(counts[2] || 0);

        var countEl = document.getElementById('lf-count');
        if (countEl) {
            if (!currentState.country && !currentState.query) {
                countEl.textContent = 'Showing all ' + tunerData.length + ' servers';
            } else {
                countEl.textContent = 'Showing ' + visible + ' of ' + tunerData.length + ' servers';
            }
        }
    }

    function setCountry(code) {
        code = norm(code);
        if (!initialized) {
            pendingCountry = code; // applied on init (e.g. ?country= deep link)
            return;
        }
        currentState.country = code;
        var select = document.getElementById('lf-country');
        if (select) {
            select.value = code;
        }
        applyDomFilter();
    }

    function setQuery(q) {
        currentState.query = String(q === null || q === undefined ? '' : q);
        if (initialized) {
            applyDomFilter();
        }
    }

    function clear() {
        currentState = { country: '', query: '' };
        var select = document.getElementById('lf-country');
        if (select) {
            select.value = '';
        }
        var searchInput = document.getElementById('tuner-search');
        if (searchInput) {
            searchInput.value = '';
        }
        applyDomFilter();
    }

    // Call once, after populateTunerList() has rendered the rows.
    // Safe to call with the full dataset (tunersOnline).
    function init(tuners) {
        if (initialized) {
            return;
        }
        tunerData = tuners || [];
        injectStyles();
        buildUI(buildCountryIndex(tunerData), tunerData.length);
        initialized = true;
        if (pendingCountry) {
            setCountry(pendingCountry);
            pendingCountry = '';
        } else {
            applyDomFilter();
        }
    }

    var api = {
        version: '1.0.0',
        // Pure logic (also exported for Node tests):
        US_STATE_ALIASES: US_STATE_ALIASES,
        buildCountryIndex: buildCountryIndex,
        matchesFilter: matchesFilter,
        applyFilters: applyFilters,
        // Browser wiring:
        init: init,
        setCountry: setCountry,
        setQuery: setQuery,
        clear: clear,
        // Predicate against the CURRENT filter state -- used by the
        // optional "discover from filtered set" follow-up (see scope doc).
        // NOT used by default: the discover button is intentionally
        // left drawing from the full map-visible set.
        passesFilter: function (tuner) {
            return matchesFilter(tuner, currentState);
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api; // Node: require() for testing
    } else {
        global.LocationFilter = api; // Browser: <script> global
    }
})(typeof window !== 'undefined' ? window : this);
