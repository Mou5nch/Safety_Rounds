/* ==========================================================================
   Safety Rounds — Vistas de listado
   Cuestionarios (por carpetas) · Visitas realizadas · Desviaciones · Acciones
   ========================================================================== */
(function (global) {
  'use strict';

  var el = UI.el, esc = UI.esc;

  // Valor centinela para "cuestionarios que no están en ninguna carpeta":
  // no puede ser '' porque ese valor significa "todas las carpetas".
  var NO_FOLDER = '*none';

  var ui = {
    folderId: '',          // carpeta activa en Cuestionarios
    search: '',
    histFilter: { q: '', formId: '', status: '', folderId: '' },
    devFilter: { q: '', status: '', severityId: '', categoryId: '', centerId: '' },
    devSort: 'created_desc',
    actFilter: { q: '', status: 'pending', responsible: '' },
    actSort: null   // null = orden por defecto (vencidas primero, luego fecha límite)
  };

  /* ======================================================================
     1 · Cuestionarios
     ====================================================================== */

  function renderForms(mode) {
    // mode 'run'  → lanzar visitas (Cuestionarios)
    // mode 'edit' → administrar plantillas (Configuración cuestionarios)
    var view = UI.$('#view');
    view.className = 'view';
    UI.clear(view);

    var isEdit = mode === 'edit';
    App.setHeader(
      isEdit ? 'Configuración de cuestionarios' : 'Cuestionarios',
      isEdit ? 'Crea y edita las plantillas de inspección' : 'Elige un cuestionario para iniciar una visita',
      isEdit ? [
        el('button', {
          class: 'btn btn--ghost btn--sm', html: ico('folderPlus', 16) + '<span>Nueva carpeta</span>',
          onclick: newFolder
        }),
        el('button', {
          class: 'btn btn--primary btn--sm', html: ico('plus', 16) + '<span>Nuevo cuestionario</span>',
          onclick: function () { Builder.open(null); }
        })
      ] : []
    );

    var forms = Store.all('forms').filter(function (f) { return !f.archived; });

    if (!forms.length) {
      view.appendChild(el('div', { class: 'card' }, el('div', { class: 'card__body' },
        UI.empty('clipboard', 'Aún no hay cuestionarios',
          isEdit
            ? 'Crea tu primer cuestionario arrastrando módulos: puntos de inspección, fotos, firmas y lógica condicional.'
            : 'Pide al administrador que cree un cuestionario, o créalo tú desde Configuración de cuestionarios.',
          el('button', {
            class: 'btn btn--primary', html: ico('plus', 17) + '<span>Crear el primer cuestionario</span>',
            onclick: function () { Builder.open(null); }
          })))));
      return;
    }

    // Borradores pendientes
    if (!isEdit) {
      var drafts = Store.all('visits').filter(function (v) { return v.status !== 'completed'; })
        .sort(function (a, b) { return b.updatedAt < a.updatedAt ? -1 : 1; });
      if (drafts.length) view.appendChild(draftsCard(drafts));
    }

    // Carpetas
    view.appendChild(folderBar(forms, isEdit));

    // Buscador
    var tools = el('div', { class: 'toolbar' });
    tools.appendChild(searchBox(ui.search, function (v) { ui.search = v; renderForms(mode); }, 'Buscar cuestionario…'));
    view.appendChild(tools);

    var visible = forms.filter(function (f) {
      if (ui.folderId === NO_FOLDER) { if (f.folderId) return false; }
      else if (ui.folderId && f.folderId !== ui.folderId) return false;
      if (ui.search) {
        var q = ui.search.toLowerCase();
        return (f.name + ' ' + (f.description || '')).toLowerCase().indexOf(q) !== -1;
      }
      return true;
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });

    if (!visible.length) {
      view.appendChild(el('div', { class: 'card' }, el('div', { class: 'card__body' },
        UI.empty('search', 'Sin resultados', 'No hay cuestionarios que coincidan con la búsqueda o la carpeta seleccionada.'))));
      return;
    }

    var grid = el('div', { class: 'grid-cards' });
    visible.forEach(function (f) { grid.appendChild(formCard(f, isEdit, mode)); });
    view.appendChild(grid);
  }

  function draftsCard(drafts) {
    var card = el('div', { class: 'card', style: { marginBottom: '18px', borderColor: '#F8D4D4' } });
    card.appendChild(el('div', { class: 'card__head' }, [
      el('span', {
        style: { width: '30px', height: '30px', borderRadius: '9px', background: 'var(--coral-wash)', color: 'var(--coral-dark)', display: 'grid', placeItems: 'center', flex: 'none' },
        html: ico('edit', 16)
      }),
      el('div', {}, [
        el('div', { class: 'card__title', text: 'Visitas sin terminar' }),
        el('div', {
          class: 'card__sub',
          text: drafts.length + ' ' + UI.plural(drafts.length, 'borrador', 'borradores') + ' ' +
            UI.plural(drafts.length, 'guardado', 'guardados') + ' en este dispositivo'
        })
      ])
    ]));
    var body = el('div', { class: 'card__body', style: { paddingTop: '14px' } });
    drafts.slice(0, 4).forEach(function (v) {
      body.appendChild(visitRow(v, { compact: true }));
    });
    card.appendChild(body);
    return card;
  }

  function folderBar(forms, isEdit) {
    var bar = el('div', { class: 'folders' });
    var counts = {};
    forms.forEach(function (f) { var k = f.folderId || ''; counts[k] = (counts[k] || 0) + 1; });

    bar.appendChild(chipBtn('Todos', forms.length, ui.folderId === '', '#7A83A3', function () {
      ui.folderId = ''; renderForms(isEdit ? 'edit' : 'run');
    }));

    Store.all('folders').sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).forEach(function (fo) {
      var chip = chipBtn(fo.name, counts[fo.id] || 0, ui.folderId === fo.id, fo.color, function () {
        ui.folderId = ui.folderId === fo.id ? '' : fo.id;
        renderForms(isEdit ? 'edit' : 'run');
      });
      if (isEdit) {
        chip.addEventListener('contextmenu', function (e) { e.preventDefault(); folderMenu(fo); });
        chip.title = 'Clic derecho para renombrar o eliminar';
      }
      bar.appendChild(chip);
    });

    if (counts['']) {
      bar.appendChild(chipBtn('Sin carpeta', counts[''], ui.folderId === NO_FOLDER, '#C4C9DE', function () {
        ui.folderId = ui.folderId === NO_FOLDER ? '' : NO_FOLDER;
        renderForms(isEdit ? 'edit' : 'run');
      }));
    }

    if (isEdit) {
      bar.appendChild(el('button', {
        class: 'folder-chip', style: { borderStyle: 'dashed', color: 'var(--ink-3)' },
        html: ico('plus', 15) + '<span>Carpeta</span>',
        onclick: newFolder
      }));
    }
    return bar;
  }

  function chipBtn(label, count, active, color, onClick) {
    return el('button', { class: 'folder-chip' + (active ? ' is-active' : ''), onclick: onClick }, [
      el('span', { class: 'folder-chip__dot', style: { background: color || '#7A83A3' } }),
      el('span', { text: label }),
      el('span', { class: 'folder-chip__count', text: String(count) })
    ]);
  }

  function newFolder() {
    UI.prompt({
      title: 'Nueva carpeta',
      text: 'Agrupa los cuestionarios por tipo de inspección, centro o normativa.',
      label: 'Nombre de la carpeta',
      placeholder: 'Ej.: Inspecciones mensuales'
    }).then(function (name) {
      if (!name) return;
      var colors = ['#1E2B6F', '#4356AE', '#178A6B', '#C77A10', '#6B4EA8', '#E05C5C'];
      var n = Store.all('folders').length;
      Store.put('folders', { id: Store.uid('fol'), name: name, color: colors[n % colors.length], order: n });
      UI.toast('Carpeta «' + name + '» creada.');
      renderForms('edit');
    });
  }

  function folderMenu(folder) {
    UI.modal({
      title: folder.name,
      subtitle: 'Carpeta de cuestionarios',
      icon: 'folder',
      body: el('div', { class: 'hint', style: { paddingBottom: '8px' } },
        'Al eliminar la carpeta, sus cuestionarios no se borran: quedan sin carpeta asignada.'),
      footSplit: true,
      buttons: [
        {
          label: 'Eliminar', kind: 'danger', icon: 'trash', onClick: function () {
            Store.all('forms').forEach(function (f) {
              if (f.folderId === folder.id) { f.folderId = null; Store.put('forms', f); }
            });
            Store.remove('folders', folder.id);
            if (ui.folderId === folder.id) ui.folderId = '';
            UI.toast('Carpeta eliminada.');
            renderForms('edit');
          }
        },
        {
          label: 'Renombrar', kind: 'navy', icon: 'edit', onClick: function () {
            UI.prompt({ title: 'Renombrar carpeta', label: 'Nombre', value: folder.name }).then(function (n) {
              if (!n) return;
              folder.name = n;
              Store.put('folders', folder);
              renderForms('edit');
            });
          }
        }
      ]
    });
  }

  function formCard(f, isEdit, mode) {
    var qs = (f.fields || []).filter(Builder.isQuestion).length;
    var cis = (f.fields || []).filter(function (x) { return x.type === 'checkitem'; }).length;
    var visits = Store.all('visits').filter(function (v) { return v.formId === f.id && v.status === 'completed'; }).length;
    var folder = f.folderId ? Store.get('folders', f.folderId) : null;

    var card = el('div', { class: 'form-card' });
    card.appendChild(el('div', { class: 'form-card__top' }, [
      el('div', { class: 'form-card__icon', style: { background: f.color || '#1E2B6F' }, html: ico(f.icon || 'clipboard', 21) }),
      el('div', { style: { minWidth: '0', flex: '1' } }, [
        el('div', { class: 'form-card__name', text: f.name }),
        folder ? el('div', { style: { fontSize: '12px', color: 'var(--ink-3)', marginTop: '2px' }, text: folder.name }) : null
      ])
    ]));

    if (f.description) card.appendChild(el('div', { class: 'form-card__desc', text: f.description }));

    var meta = el('div', { class: 'form-card__meta' });
    meta.appendChild(el('span', { class: 'tag', text: UI.num(qs) + ' ' + UI.plural(qs, 'pregunta') }));
    if (cis) meta.appendChild(el('span', { class: 'tag tag--navy', text: cis + ' ' + UI.plural(cis, 'punto') }));
    if (visits) meta.appendChild(el('span', { class: 'tag tag--ok', text: visits + ' ' + UI.plural(visits, 'visita') }));
    if (f.emails && f.emails.length) meta.appendChild(el('span', { class: 'tag', html: ico('mail', 12) + (f.emails.length) }));
    card.appendChild(meta);

    var foot = el('div', { class: 'form-card__foot' });
    if (isEdit) {
      foot.appendChild(el('button', {
        class: 'btn btn--ghost btn--sm', style: { flex: '1' },
        html: ico('edit', 15) + '<span>Editar</span>',
        onclick: function () { Builder.open(f.id); }
      }));
      foot.appendChild(el('button', {
        class: 'btn btn--ghost btn--sm btn--icon', title: 'Más opciones', html: ico('sliders', 15),
        onclick: function () { formMenu(f, mode); }
      }));
    } else {
      foot.appendChild(el('button', {
        class: 'btn btn--primary btn--sm', style: { flex: '1' },
        html: ico('play', 15) + '<span>Nueva visita</span>',
        onclick: function () { Runner.start(f.id); }
      }));
      foot.appendChild(el('button', {
        class: 'btn btn--ghost btn--sm btn--icon', title: 'Vista previa', html: ico('eye', 15),
        onclick: function () { Runner.preview(f); }
      }));
    }
    card.appendChild(foot);
    return card;
  }

  function formMenu(f, mode) {
    var folders = Store.all('folders');
    var body = el('div', { style: { paddingBottom: '6px' } });

    if (folders.length) {
      var sel = UI.selectFrom(
        [{ value: '', label: 'Sin carpeta' }].concat(folders.map(function (x) { return { value: x.id, label: x.name }; })),
        f.folderId || '', { class: 'select' });
      sel.addEventListener('change', function () {
        f.folderId = sel.value || null;
        Store.put('forms', f);
        UI.toast('Cuestionario movido.');
      });
      body.appendChild(UI.field('Carpeta', sel));
    }

    var used = Store.all('visits').filter(function (v) { return v.formId === f.id; }).length;
    body.appendChild(el('div', { class: 'hint' },
      used ? 'Este cuestionario tiene ' + used + ' ' + UI.plural(used, 'visita') + ' asociadas. Al eliminarlo puedes conservarlas o borrarlas también.'
           : 'Este cuestionario no tiene visitas asociadas.'));

    UI.modal({
      title: f.name,
      subtitle: 'Opciones del cuestionario',
      icon: 'clipboard',
      body: body,
      footSplit: true,
      buttons: [
        { label: 'Eliminar', kind: 'danger', icon: 'trash', onClick: function () { deleteForm(f, mode); } },
        { label: 'Duplicar', kind: 'navy', icon: 'copy', onClick: function () {
          var copy = Store.clone(f);
          copy.id = Store.uid('form');
          copy.name = f.name + ' (copia)';
          delete copy.createdAt; delete copy.updatedAt;
          Store.put('forms', copy);
          UI.toast('Cuestionario duplicado.');
          renderForms(mode);
        } }
      ]
    });
  }

  function deleteForm(f, mode) {
    var visits = Store.all('visits').filter(function (v) { return v.formId === f.id; });
    UI.confirm({
      title: 'Eliminar «' + f.name + '»',
      text: visits.length
        ? 'Se eliminará la plantilla. Las ' + visits.length + ' ' + UI.plural(visits.length, 'visita') +
          ' ya realizadas se conservan y seguirán siendo consultables y exportables a PDF.'
        : 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar cuestionario'
    }).then(function (ok) {
      if (!ok) return;
      Store.remove('forms', f.id);
      UI.toast('Cuestionario eliminado.');
      renderForms(mode);
    });
  }

  /* ======================================================================
     2 · Visitas realizadas
     ====================================================================== */

  function renderHistory() {
    var view = UI.$('#view');
    view.className = 'view';
    UI.clear(view);

    var all = Store.all('visits').sort(function (a, b) {
      return (b.date || '') < (a.date || '') ? -1 : (b.date || '') > (a.date || '') ? 1 : (b.createdAt < a.createdAt ? -1 : 1);
    });

    App.setHeader('Visitas realizadas', 'Archivo de inspecciones · consulta, edición y descarga en PDF',
      all.length ? [
        el('button', {
          class: 'btn btn--ghost btn--sm', html: ico('table', 16) + '<span>Exportar CSV</span>',
          onclick: function () { Dashboard.exportVisits(filterHistory(all)); }
        })
      ] : []);

    if (!all.length) {
      view.appendChild(el('div', { class: 'card' }, el('div', { class: 'card__body' },
        UI.empty('inbox', 'Todavía no hay visitas',
          'Aquí se irán archivando todas las inspecciones realizadas. Podrás consultarlas, editarlas si hubo algún error y descargarlas en PDF.',
          el('button', {
            class: 'btn btn--primary', html: ico('play', 17) + '<span>Realizar una visita</span>',
            onclick: function () { App.go('cuestionarios'); }
          })))));
      return;
    }

    var bar = el('div', { class: 'filters' });
    bar.appendChild(UI.field('Buscar', searchInput(ui.histFilter.q, function (v) { ui.histFilter.q = v; renderHistory(); }, 'Referencia, inspector, centro…')));
    bar.appendChild(UI.field('Cuestionario', pickSelect(ui.histFilter, 'formId',
      uniqueForms(all), 'Todos', renderHistory)));
    bar.appendChild(UI.field('Estado', pickSelect(ui.histFilter, 'status', [
      { value: 'completed', label: 'Finalizadas' },
      { value: 'draft', label: 'Borradores' }
    ], 'Todas', renderHistory)));

    view.appendChild(bar);

    var rows = filterHistory(all);
    view.appendChild(el('div', {
      style: { fontSize: '13px', color: 'var(--ink-3)', marginBottom: '12px' },
      text: UI.num(rows.length) + ' ' + UI.plural(rows.length, 'visita') + ' ' + (rows.length === all.length ? 'en total' : 'de ' + UI.num(all.length))
    }));

    if (!rows.length) {
      view.appendChild(el('div', { class: 'card' }, el('div', { class: 'card__body' },
        UI.empty('search', 'Sin resultados', 'Prueba a cambiar los filtros de búsqueda.'))));
      return;
    }

    var list = el('div');
    rows.forEach(function (v) { list.appendChild(visitRow(v)); });
    view.appendChild(list);
  }

  function uniqueForms(visits) {
    var seen = {};
    var out = [];
    visits.forEach(function (v) {
      if (!v.formId || seen[v.formId]) return;
      seen[v.formId] = true;
      out.push({ value: v.formId, label: v.formName || 'Sin nombre' });
    });
    return out;
  }

  function filterHistory(all) {
    var f = ui.histFilter;
    return all.filter(function (v) {
      if (f.formId && v.formId !== f.formId) return false;
      if (f.status === 'completed' && v.status !== 'completed') return false;
      if (f.status === 'draft' && v.status === 'completed') return false;
      if (f.q) {
        var hay = [v.code, v.formName, v.inspector,
          v.centerId ? Store.catalogName(v.centerId) : '',
          v.areaId ? Store.catalogName(v.areaId) : ''].join(' ').toLowerCase();
        if (hay.indexOf(f.q.toLowerCase()) === -1) return false;
      }
      return true;
    });
  }

  function visitRow(v, opts) {
    opts = opts || {};
    var s = v.score || { ok: 0, ko: 0, pct: 0, total: 0 };
    var done = v.status === 'completed';
    var col = UI.scoreColor(s.pct);

    var row = el('div', { class: 'visit-row' });

    row.appendChild(el('div', {
      class: 'visit-row__score',
      style: done && s.total ? { background: col.bg, color: col.fg } : { background: 'var(--surface)', color: 'var(--ink-3)' },
      html: done && s.total ? UI.pct(s.pct) : ico(done ? 'check' : 'edit', 19)
    }));

    var metaParts = [
      el('span', { html: ico('calendar', 13) + '<span>' + esc(UI.fmtDate(v.date)) + '</span>' }),
      v.inspector ? el('span', { html: ico('user', 13) + '<span>' + esc(v.inspector) + '</span>' }) : null,
      v.centerId ? el('span', { html: ico('building', 13) + '<span>' + esc(Store.catalogName(v.centerId)) + '</span>' }) : null,
      v.areaId ? el('span', { html: ico('mapPin', 13) + '<span>' + esc(Store.catalogName(v.areaId)) + '</span>' }) : null
    ].filter(Boolean);

    row.appendChild(el('div', { class: 'visit-row__main' }, [
      el('div', { class: 'visit-row__title', text: v.code + ' · ' + (v.formName || 'Sin cuestionario') }),
      el('div', { class: 'visit-row__meta' }, metaParts)
    ]));

    var tags = el('div', { class: 'visit-row__tags' });
    if (!done) tags.appendChild(el('span', { class: 'tag tag--warn', text: 'Borrador' }));
    else if (s.ko) tags.appendChild(el('span', { class: 'tag tag--danger', html: ico('alert', 12) + s.ko }));
    else if (s.total) tags.appendChild(el('span', { class: 'tag tag--ok', html: ico('check', 12) + 'Sin desviaciones' }));
    row.appendChild(tags);

    var actions = el('div', { class: 'visit-row__actions' });
    if (done) {
      actions.appendChild(el('button', {
        class: 'btn btn--ghost btn--sm btn--icon', title: 'Ver informe PDF', html: ico('filePdf', 15),
        onclick: function () { PDF.open(v.id); }
      }));
      actions.appendChild(el('button', {
        class: 'btn btn--ghost btn--sm btn--icon', title: 'Enviar por correo', html: ico('mail', 15),
        onclick: function () { PDF.sendByEmail(v.id); }
      }));
      actions.appendChild(el('button', {
        class: 'btn btn--ghost btn--sm btn--icon', title: 'Compartir enlace', html: ico('send', 15),
        onclick: function () { Share.visit(v); }
      }));
    }
    actions.appendChild(el('button', {
      class: 'btn btn--ghost btn--sm btn--icon', title: done ? 'Editar visita' : 'Continuar', html: ico(done ? 'edit' : 'play', 15),
      onclick: function () { Runner.start(v.formId, v.id); }
    }));
    if (!opts.compact) {
      actions.appendChild(el('button', {
        class: 'btn btn--ghost btn--sm btn--icon', title: 'Eliminar', html: ico('trash', 15),
        onclick: function () { deleteVisit(v); }
      }));
    }
    row.appendChild(actions);

    return row;
  }

  function deleteVisit(v) {
    var devs = Store.query('deviations', function (d) { return d.visitId === v.id; });
    UI.confirm({
      title: 'Eliminar visita ' + v.code,
      text: devs.length
        ? 'Se eliminarán también sus ' + devs.length + ' ' + UI.plural(devs.length, 'desviación', 'desviaciones') +
          ' y las acciones correctoras asociadas. Esta acción no se puede deshacer.'
        : 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar visita'
    }).then(function (ok) {
      if (!ok) return;
      devs.forEach(function (d) {
        Store.query('actions', function (a) { return a.deviationId === d.id; })
          .forEach(function (a) { Store.remove('actions', a.id); });
        Store.remove('deviations', d.id);
      });
      Store.remove('visits', v.id);
      UI.toast('Visita ' + v.code + ' eliminada.');
      App.refreshBadges();
      renderHistory();
    });
  }

  /* ======================================================================
     3 · Desviaciones
     ====================================================================== */

  function renderDeviations() {
    var view = UI.$('#view');
    view.className = 'view';
    UI.clear(view);

    var all = sortDevs(Store.all('deviations'));

    App.setHeader('Desviaciones detectadas', 'Todas las no conformidades registradas en las inspecciones',
      all.length ? [
        el('button', {
          class: 'btn btn--ghost btn--sm', html: ico('table', 16) + '<span>Exportar CSV</span>',
          onclick: function () { Dashboard.exportDeviations(filterDevs(all)); }
        })
      ] : []);

    if (!all.length) {
      view.appendChild(el('div', { class: 'card' }, el('div', { class: 'card__body' },
        UI.empty('checkCircle', 'Ninguna desviación registrada',
          'Las desviaciones se generan automáticamente cuando en una visita marcas un punto de inspección como «No correcto».'))));
      return;
    }

    var bar = el('div', { class: 'filters' });
    bar.appendChild(UI.field('Buscar', searchInput(ui.devFilter.q, function (v) { ui.devFilter.q = v; renderDeviations(); }, 'Descripción, punto, visita…')));
    bar.appendChild(UI.field('Estado', pickSelect(ui.devFilter, 'status', [
      { value: 'open', label: 'Abiertas' },
      { value: 'closed', label: 'Cerradas' }
    ], 'Todas', renderDeviations)));
    bar.appendChild(UI.field('Gravedad', pickSelect(ui.devFilter, 'severityId',
      Store.catalog('severity').map(catOpt), 'Todas', renderDeviations)));
    bar.appendChild(UI.field('Categoría', pickSelect(ui.devFilter, 'categoryId',
      Store.catalog('category').map(catOpt), 'Todas', renderDeviations)));
    bar.appendChild(UI.field('Centro', pickSelect(ui.devFilter, 'centerId',
      Store.catalog('center').map(catOpt), 'Todos', renderDeviations)));
    bar.appendChild(UI.field('Ordenar por', sortSelect(ui.devSort, [
      { value: 'created_desc', label: 'Creación: más recientes' },
      { value: 'created_asc', label: 'Creación: más antiguas' },
      { value: 'date_desc', label: 'Fecha de visita: más reciente' },
      { value: 'date_asc', label: 'Fecha de visita: más antigua' },
      { value: 'severity', label: 'Gravedad' },
      { value: 'status', label: 'Abiertas primero' }
    ], function (v) { ui.devSort = v; renderDeviations(); })));
    view.appendChild(bar);

    var rows = filterDevs(all);
    view.appendChild(el('div', {
      style: { fontSize: '13px', color: 'var(--ink-3)', marginBottom: '12px' },
      text: UI.num(rows.length) + ' ' + UI.plural(rows.length, 'desviación', 'desviaciones') + (rows.length === all.length ? '' : ' de ' + UI.num(all.length))
    }));

    if (!rows.length) {
      view.appendChild(el('div', { class: 'card' }, el('div', { class: 'card__body' },
        UI.empty('search', 'Sin resultados', 'Prueba a cambiar los filtros.'))));
      return;
    }

    var grid = el('div', { class: 'grid-cards' });
    rows.forEach(function (d) { grid.appendChild(devCard(d)); });
    view.appendChild(grid);
  }

  function catOpt(c) { return { value: c.id, label: c.name }; }

  function sortDevs(all) {
    var key = ui.devSort || 'created_desc';
    var copy = all.slice();
    if (key === 'created_asc') return copy.sort(function (a, b) { return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1; });
    if (key === 'date_desc') return copy.sort(function (a, b) { return (b.date || '') < (a.date || '') ? -1 : 1; });
    if (key === 'date_asc') return copy.sort(function (a, b) { return (a.date || '') < (b.date || '') ? -1 : 1; });
    if (key === 'severity') return copy.sort(function (a, b) { return severityOrder(a) - severityOrder(b); });
    if (key === 'status') return copy.sort(function (a, b) {
      var oa = a.status === 'closed' ? 1 : 0, ob = b.status === 'closed' ? 1 : 0;
      return oa !== ob ? oa - ob : (b.createdAt || '') < (a.createdAt || '') ? -1 : 1;
    });
    // created_desc: recién creadas primero (por defecto)
    return copy.sort(function (a, b) { return (b.createdAt || '') < (a.createdAt || '') ? -1 : 1; });
  }

  function severityOrder(d) {
    if (!d.severityId) return 999;
    var c = Store.get('catalogs', d.severityId);
    return c && c.order != null ? c.order : 999;
  }

  function filterDevs(all) {
    var f = ui.devFilter;
    return all.filter(function (d) {
      if (f.status === 'open' && d.status === 'closed') return false;
      if (f.status === 'closed' && d.status !== 'closed') return false;
      if (f.severityId && d.severityId !== f.severityId) return false;
      if (f.categoryId && d.categoryId !== f.categoryId) return false;
      if (f.centerId && d.centerId !== f.centerId) return false;
      if (f.q) {
        var hay = [d.description, d.question, d.visitCode, d.formName, d.inspector].join(' ').toLowerCase();
        if (hay.indexOf(f.q.toLowerCase()) === -1) return false;
      }
      return true;
    });
  }

  function devCard(d) {
    var closed = d.status === 'closed';
    var card = el('div', { class: 'form-card', style: { gap: '11px' } });

    var top = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } });
    if (d.severityId) {
      var c = Store.catalogColor(d.severityId);
      top.appendChild(el('span', {
        class: 'tag', style: { background: UI.withAlpha(c, .13), color: c },
        text: Store.catalogName(d.severityId)
      }));
    }
    if (d.categoryId) top.appendChild(el('span', { class: 'tag', text: Store.catalogName(d.categoryId) }));
    top.appendChild(el('span', {
      class: 'tag ' + (closed ? 'tag--ok' : 'tag--danger'),
      html: ico(closed ? 'check' : 'alert', 12) + (closed ? 'Cerrada' : 'Abierta')
    }));
    card.appendChild(top);

    card.appendChild(el('div', { style: { fontSize: '14.5px', fontWeight: '650', lineHeight: '1.35' }, text: d.question }));
    card.appendChild(el('div', { class: 'form-card__desc', style: { WebkitLineClamp: '3' }, text: d.description || 'Sin descripción' }));

    if ((d.photos || []).length) {
      var strip = el('div', { style: { display: 'flex', gap: '6px' } });
      d.photos.slice(0, 4).forEach(function (p) {
        strip.appendChild(el('img', {
          src: p, alt: 'Evidencia', loading: 'lazy',
          style: { width: '52px', height: '52px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--line)', cursor: 'zoom-in' },
          onclick: function () { showPhoto(p); }
        }));
      });
      if (d.photos.length > 4) {
        strip.appendChild(el('div', {
          style: { width: '52px', height: '52px', borderRadius: '8px', background: 'var(--surface)', display: 'grid', placeItems: 'center', fontSize: '12px', color: 'var(--ink-3)', fontWeight: '600' },
          text: '+' + (d.photos.length - 4)
        }));
      }
      card.appendChild(strip);
    }

    var meta = el('div', { class: 'meta-line' }, [
      el('span', { html: ico('clipboard', 12) + '<span>' + esc(d.visitCode || '') + '</span>' }),
      el('span', { html: ico('calendar', 12) + '<span>' + esc(UI.fmtDate(d.date)) + '</span>' }),
      d.centerId ? el('span', { html: ico('building', 12) + '<span>' + esc(Store.catalogName(d.centerId)) + '</span>' }) : null
    ].filter(Boolean));
    card.appendChild(meta);

    var foot = el('div', { class: 'form-card__foot' });
    foot.appendChild(el('button', {
      class: 'btn btn--ghost btn--sm', style: { flex: '1' },
      html: ico(closed ? 'refresh' : 'check', 15) + '<span>' + (closed ? 'Reabrir' : 'Cerrar') + '</span>',
      onclick: function () {
        d.status = closed ? 'open' : 'closed';
        d.closedAt = closed ? null : Store.nowISO();
        Store.put('deviations', d);
        UI.toast(closed ? 'Desviación reabierta.' : 'Desviación cerrada.');
        App.refreshBadges();
        renderDeviations();
      }
    }));
    foot.appendChild(el('button', {
      class: 'btn btn--ghost btn--sm btn--icon', title: 'Abrir la visita', html: ico('external', 15),
      onclick: function () { Runner.start(d.formId, d.visitId); }
    }));
    card.appendChild(foot);

    return card;
  }

  function showPhoto(src) {
    UI.modal({
      title: 'Evidencia fotográfica', size: 'wide',
      body: el('div', { style: { textAlign: 'center', paddingBottom: '10px' } },
        el('img', { src: src, style: { maxWidth: '100%', maxHeight: '68vh', borderRadius: '12px' } })),
      buttons: [{ label: 'Cerrar', kind: 'navy' }]
    });
  }

  /* ======================================================================
     4 · Plan de acción
     ====================================================================== */

  function renderActions() {
    var view = UI.$('#view');
    view.className = 'view';
    UI.clear(view);

    var all = Store.all('actions');

    App.setHeader('Plan de acción', 'Seguimiento de las acciones correctoras hasta su cierre',
      all.length ? [
        el('button', {
          class: 'btn btn--ghost btn--sm', html: ico('table', 16) + '<span>Exportar CSV</span>',
          onclick: function () { Dashboard.exportActions(); }
        })
      ] : []);

    if (!all.length) {
      view.appendChild(el('div', { class: 'card' }, el('div', { class: 'card__body' },
        UI.empty('target', 'No hay acciones correctoras',
          'Cuando registres una desviación y le asignes una acción correctora con responsable y fecha límite, aparecerá aquí para su seguimiento.'))));
      return;
    }

    var open = all.filter(function (a) { return a.status === 'open'; }).length;
    var prog = all.filter(function (a) { return a.status === 'progress'; }).length;
    var done = all.filter(function (a) { return a.status === 'done'; }).length;
    var over = all.filter(Dashboard.isOverdue).length;

    var kpis = el('div', { class: 'kpis' });
    kpis.appendChild(kpiBox('Abiertas', open, 'coral'));
    kpis.appendChild(kpiBox('En curso', prog, 'warn'));
    kpis.appendChild(kpiBox('Cerradas', done, 'ok'));
    kpis.appendChild(kpiBox('Vencidas', over, over ? 'coral' : 'navy'));
    view.appendChild(kpis);

    var bar = el('div', { class: 'filters' });
    bar.appendChild(UI.field('Buscar', searchInput(ui.actFilter.q, function (v) { ui.actFilter.q = v; renderActions(); }, 'Acción, responsable, visita…')));
    bar.appendChild(UI.field('Estado', pickSelect(ui.actFilter, 'status', [
      { value: 'pending', label: 'Pendientes' },
      { value: 'open', label: 'Abiertas' },
      { value: 'progress', label: 'En curso' },
      { value: 'done', label: 'Cerradas' },
      { value: 'overdue', label: 'Vencidas' }
    ], 'Todas', renderActions)));
    view.appendChild(bar);

    var rows = all.filter(function (a) {
      var f = ui.actFilter;
      if (f.status === 'pending' && a.status === 'done') return false;
      if (f.status === 'overdue' && !Dashboard.isOverdue(a)) return false;
      if (['open', 'progress', 'done'].indexOf(f.status) !== -1 && a.status !== f.status) return false;
      if (f.q) {
        var hay = [a.title, a.responsible, a.visitCode, a.description].join(' ').toLowerCase();
        if (hay.indexOf(f.q.toLowerCase()) === -1) return false;
      }
      return true;
    });
    rows = sortActions(rows);

    if (!rows.length) {
      view.appendChild(el('div', { class: 'card' }, el('div', { class: 'card__body' },
        UI.empty('search', 'Sin resultados', 'Prueba a cambiar los filtros.'))));
      return;
    }

    var table = el('table', { class: 'table' });
    table.appendChild(el('thead', {}, el('tr', {}, [
      sortableHeader('Acción correctora', 'title', renderActions),
      sortableHeader('Responsable', 'responsible', renderActions),
      sortableHeader('Fecha límite', 'dueDate', renderActions),
      sortableHeader('Estado', 'status', renderActions),
      el('th', { text: '' })
    ])));
    var tb = el('tbody');
    rows.forEach(function (a) { tb.appendChild(actionRow(a)); });
    table.appendChild(tb);

    view.appendChild(el('div', { class: 'card' }, el('div', { class: 'table-wrap' }, table)));
  }

  function kpiBox(label, value, kind) {
    return el('div', { class: 'kpi kpi--' + kind }, [
      el('div', { class: 'kpi__label', text: label }),
      el('div', { class: 'kpi__value', text: UI.num(value) })
    ]);
  }

  function sortActions(rows) {
    var s = ui.actSort;
    if (!s) {
      // Orden por defecto: vencidas primero, luego por fecha límite más próxima
      return rows.slice().sort(function (a, b) {
        var oa = Dashboard.isOverdue(a) ? 0 : 1, ob = Dashboard.isOverdue(b) ? 0 : 1;
        if (oa !== ob) return oa - ob;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate < b.dueDate ? -1 : 1;
      });
    }
    var dir = s.dir === 'desc' ? -1 : 1;
    return rows.slice().sort(function (a, b) {
      var va = actSortValue(a, s.key), vb = actSortValue(b, s.key);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

  function actSortValue(a, key) {
    if (key === 'title') return (a.title || '').toLowerCase();
    if (key === 'responsible') return (a.responsible || '').toLowerCase();
    if (key === 'dueDate') return a.dueDate || '9999-99-99';
    if (key === 'status') {
      var order = { open: 0, progress: 1, done: 2 };
      return order[a.status] != null ? order[a.status] : 3;
    }
    return '';
  }

  function sortableHeader(label, key, onChange) {
    var active = ui.actSort && ui.actSort.key === key;
    var dir = active ? ui.actSort.dir : null;
    return el('th', {}, el('button', {
      class: 'th-sort' + (active ? ' is-active' : ''),
      type: 'button',
      title: 'Ordenar por ' + label.toLowerCase(),
      onclick: function () {
        ui.actSort = { key: key, dir: active && dir === 'asc' ? 'desc' : 'asc' };
        onChange();
      }
    }, [
      el('span', { text: label }),
      el('span', { class: 'th-sort__icon', html: ico(active && dir === 'desc' ? 'arrowDown' : 'arrowUp', 12) })
    ]));
  }

  function actionRow(a) {
    var overdue = Dashboard.isOverdue(a);
    var days = a.dueDate ? UI.relativeDays(a.dueDate) : null;

    var tr = el('tr');
    tr.appendChild(el('td', {}, [
      el('div', { style: { fontWeight: '600', marginBottom: '2px' }, text: a.title || '(sin título)' }),
      el('div', { style: { fontSize: '12.5px', color: 'var(--ink-3)' }, text: (a.visitCode || '') + (a.description ? ' · ' + trunc(a.description, 70) : '') })
    ]));
    tr.appendChild(el('td', { text: a.responsible || '—' }));
    tr.appendChild(el('td', {}, a.dueDate
      ? el('div', {}, [
          el('div', { text: UI.fmtDate(a.dueDate) }),
          a.status !== 'done' && days !== null
            ? el('div', {
                style: { fontSize: '12px', color: overdue ? 'var(--coral-dark)' : days <= 7 ? 'var(--warn)' : 'var(--ink-3)', fontWeight: '600' },
                text: overdue ? 'Vencida hace ' + Math.abs(days) + 'd' : days === 0 ? 'Vence hoy' : 'Quedan ' + days + 'd'
              })
            : null
        ])
      : el('span', { style: { color: 'var(--ink-3)' }, text: 'Sin fecha' })));

    var statusSel = UI.selectFrom([
      { value: 'open', label: 'Abierta' },
      { value: 'progress', label: 'En curso' },
      { value: 'done', label: 'Cerrada' }
    ], a.status || 'open', { class: 'select select--sm', style: 'min-width:118px' });
    statusSel.addEventListener('change', function () {
      a.status = statusSel.value;
      a.closedAt = a.status === 'done' ? Store.nowISO() : null;
      Store.put('actions', a);
      // Cerrar la acción cierra también su desviación
      var d = Store.get('deviations', a.deviationId);
      if (d) {
        d.status = a.status === 'done' ? 'closed' : 'open';
        Store.put('deviations', d);
      }
      UI.toast('Acción actualizada.');
      App.refreshBadges();
      renderActions();
    });
    tr.appendChild(el('td', {}, statusSel));

    tr.appendChild(el('td', {}, el('div', { class: 'row-actions' }, [
      el('button', {
        class: 'btn btn--ghost btn--sm btn--icon', title: 'Editar seguimiento', html: ico('edit', 15),
        onclick: function () { editAction(a); }
      }),
      el('button', {
        class: 'btn btn--ghost btn--sm btn--icon', title: 'Ver la visita', html: ico('external', 15),
        onclick: function () {
          var v = Store.get('visits', a.visitId);
          if (v) Runner.start(v.formId, v.id);
          else UI.toast('La visita asociada ya no existe.', 'err');
        }
      })
    ])));
    return tr;
  }

  function editAction(a) {
    var title = el('input', { class: 'input', value: a.title || '' });
    var resp = el('input', { class: 'input', value: a.responsible || '', placeholder: 'Persona o departamento' });
    var due = el('input', { class: 'input', type: 'date', value: a.dueDate || '' });
    var notes = el('textarea', { class: 'textarea', placeholder: 'Avances, incidencias, evidencia del cierre…' });
    notes.value = a.notes || '';

    var body = el('div', { style: { paddingBottom: '6px' } }, [
      UI.field('Acción correctora', title),
      el('div', { class: 'grid-2' }, [
        UI.field('Responsable', resp),
        UI.field('Fecha límite', due)
      ]),
      UI.field('Notas de seguimiento', notes),
      el('div', { class: 'hint', text: 'Desviación asociada: ' + trunc(a.description || '—', 140) })
    ]);

    UI.modal({
      title: 'Seguimiento de la acción',
      subtitle: a.visitCode || '',
      icon: 'target',
      body: body,
      buttons: [
        { label: 'Cancelar', kind: 'quiet' },
        {
          label: 'Guardar', kind: 'primary', icon: 'save', onClick: function () {
            a.title = title.value.trim() || a.title;
            a.responsible = resp.value.trim();
            a.dueDate = due.value;
            a.notes = notes.value;
            Store.put('actions', a);
            UI.toast('Acción actualizada.');
            renderActions();
          }
        }
      ]
    });
  }

  function trunc(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  /* ======================================================================
     Controles compartidos
     ====================================================================== */

  /**
   * Buscadores con rebote. Al filtrar se redibuja la vista entera, así que el
   * input se recrea: se marca con un id estable para devolverle el foco y el
   * cursor exactamente donde estaban, en lugar de adivinar por selector.
   */
  function debouncedSearch(node, id, onChange, delay) {
    node.id = id;
    var timer;
    node.addEventListener('input', function () {
      clearTimeout(timer);
      var val = node.value;
      var pos = node.selectionStart;
      timer = setTimeout(function () {
        onChange(val);
        var again = document.getElementById(id);
        if (again && again !== node) {
          again.focus();
          try { again.setSelectionRange(pos, pos); } catch (e) {}
        }
      }, delay || 280);
    });
    return node;
  }

  function searchBox(value, onChange, placeholder) {
    var box = el('div', { class: 'search' });
    box.innerHTML = ico('search', 16);
    box.appendChild(debouncedSearch(
      el('input', { class: 'input', value: value || '', placeholder: placeholder || 'Buscar…' }),
      'srSearchForms', onChange
    ));
    return box;
  }

  function searchInput(value, onChange, placeholder, id) {
    return debouncedSearch(
      el('input', { class: 'input input--sm', value: value || '', placeholder: placeholder || 'Buscar…' }),
      id || 'srSearchFilter', onChange, 300
    );
  }

  function pickSelect(target, key, options, allLabel, onChange) {
    var s = UI.selectFrom([{ value: '', label: allLabel }].concat(options), target[key], { class: 'select select--sm' });
    s.addEventListener('change', function () { target[key] = s.value; onChange(); });
    return s;
  }

  function sortSelect(value, options, onChange) {
    var s = UI.selectFrom(options, value, { class: 'select select--sm' });
    s.addEventListener('change', function () { onChange(s.value); });
    return s;
  }

  /* ---------- Exposición ---------- */

  global.Lists = {
    forms: renderForms,
    history: renderHistory,
    deviations: renderDeviations,
    actions: renderActions,
    resetFolder: function () { ui.folderId = ''; ui.search = ''; }
  };
})(window);
