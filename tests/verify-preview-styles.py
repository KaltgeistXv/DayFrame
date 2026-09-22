"""Check actual dev-server CSS, not just source/build output (no browser UI inspection)."""
import urllib.request
urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
selectors = [
    '.reset-panel', '.reset-confirmation', '.df-drop-target', 'df-surface-in',
    '--motion-fast', '.checkin-mark', '.task-detail-scroll', '.editor.task-editor',
    '.module-view-tabs', '--ui-text-body', '--ui-control-default', '.home-card-body:focus-visible',
    '.calendar-unified-toolbar', '.calendar-toolbar-actions', '.gantt-group-header',
    '.gantt-group-toggle', '.task-detail-tabs', '.checkin-panel',
    '.month-ribbon-week', '.month-task-ribbon', '.month-more', '.year-calendar',
    '.calendar-period-switch', '.calendar-unplanned', '.active-filter-summary',
    '.view-result-count', '.daily-checkin', '.gantt-checkin-cell', '.unified-task-bar',
    '.tracking-legend', '.tracked-ribbon', '.ribbon-calendar', '.schedule-origin',
    '.date-navigator', '.date-navigation-popup', '.continuous-months', '.month-strip',
    '.continuous-timeline', '.continuous-week', '.sidebar-peek', '.sidebar-reveal',
    '.projecttoolbar', '.backup-panel', 'df-fade-in', '.home-grid', '.home-card',
    '.project-badge', '.checkin-button',
     '.task-timeline-row', '.gantt-row', '.gantt-grid', '.gantt-bar',
    '.gantt-handle', '.gantt-scroll', '.ui-color-options',
    '.ui-color-swatch', '.month-calendar-shell',
    '.month-weekdays', '.calendar-snap-point', '--month-page-height', 'scroll-snap-type',
]
for route in ['/app/globals.css?direct','/app/globals.css']:
    req=urllib.request.Request('http://localhost:3000'+route,headers={'Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=30) as response:
        css=response.read().decode()
    missing=[s for s in selectors if s not in css]
    assert not missing, f'{route} is serving stale CSS: {missing}'
print('PASS: actual preview CSS contains all Gantt and color editor layout rules in direct and module responses')
