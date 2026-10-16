/* ==========================================================================
   Safety Rounds — Contenido inicial
   Una única plantilla de demostración que enseña todos los módulos y la
   lógica IF. Es editable y borrable como cualquier otra.
   ========================================================================== */
(function (global) {
  'use strict';

  function f(type, label, extra) {
    return Object.assign({
      id: Store.uid('f'),
      type: type,
      label: label,
      hint: '',
      required: false,
      conditions: null
    }, extra || {});
  }

  function checkitem(label, hint) {
    return f('checkitem', label, {
      required: true,
      hint: hint || '',
      allowNA: true,
      deviation: { enabled: true, requirePhoto: false, requireAction: true }
    });
  }

  function opts(list) {
    return list.map(function (l) { return { id: Store.uid('o'), label: l, color: '' }; });
  }

  /* ---------- Plantilla de demostración ---------- */

  function demoForm(folderId, responsablesListId) {
    var fields = [];

    fields.push(f('title', 'Datos de la ronda'));

    // Módulo de tipología: en lugar de escribir el nombre a mano, se elige de
    // una lista mantenida en Ajustes, con su correo asociado.
    if (responsablesListId) {
      fields.push(f('listpick', 'Responsable que acompaña la ronda', {
        required: false,
        listId: responsablesListId,
        multiple: false,
        cascade: true,
        allowCreate: true,
        useEmailForReport: true,
        hint: 'Su correo se propondrá como destinatario del informe.'
      }));
    } else {
      fields.push(f('fullname', 'Responsable que acompaña la ronda', { required: false }));
    }

    fields.push(f('date', 'Fecha de la inspección', { required: true, defaultToday: true }));
    fields.push(f('paragraph', 'Recorre la zona asignada y evalúa cada punto. Marca «No correcto» cuando detectes una desviación: se abrirá automáticamente el bloque para describirla, clasificarla, fotografiarla y asignar la acción correctora.'));

    fields.push(f('subtitle', '1 · Orden, limpieza y vías de evacuación'));
    fields.push(checkitem('¿Los pasillos y las vías de evacuación están libres de obstáculos?'));
    fields.push(checkitem('¿El suelo está libre de derrames, cables sueltos y residuos?'));
    fields.push(checkitem('¿El material está apilado de forma estable y en su ubicación?'));

    fields.push(f('subtitle', '2 · Equipos de protección individual'));
    fields.push(checkitem('¿Todo el personal utiliza los EPIs obligatorios de la zona?'));

    var estado = f('radio', 'Estado general de conservación de los EPIs', {
      required: true,
      options: opts(['Bueno', 'Aceptable', 'Deficiente'])
    });
    fields.push(estado);

    // --- Lógica IF de ejemplo: solo si el estado es «Deficiente» ---
    fields.push(f('textarea', '¿Qué EPIs están deteriorados y qué medidas se han tomado?', {
      required: true,
      placeholder: 'Detalla el equipo, el número de unidades y la actuación inmediata realizada…',
      conditions: { action: 'show', logic: 'all', rules: [{ fieldId: estado.id, op: 'eq', value: 'Deficiente' }] }
    }));
    fields.push(f('photo', 'Fotografía de los EPIs deteriorados', {
      multiple: true, maxFiles: 4,
      conditions: { action: 'show', logic: 'all', rules: [{ fieldId: estado.id, op: 'eq', value: 'Deficiente' }] }
    }));

    fields.push(f('subtitle', '3 · Protección contra incendios'));
    fields.push(checkitem('¿Los extintores están señalizados, accesibles y dentro de fecha de revisión?'));
    fields.push(checkitem('¿Las salidas de emergencia abren correctamente y están despejadas?'));
    fields.push(checkitem('¿La señalización de emergencia es visible y está iluminada?'));

    fields.push(f('subtitle', '4 · Instalaciones y maquinaria'));
    fields.push(checkitem('¿Los resguardos y protecciones de las máquinas están colocados?'));
    fields.push(checkitem('¿Los cuadros eléctricos están cerrados y sin material apoyado?'));
    fields.push(f('number', 'Nivel de ruido medido en la zona', { unit: 'dB' }));

    fields.push(f('subtitle', '5 · Cierre de la visita'));
    fields.push(f('checkbox', 'Aspectos adicionales revisados durante la ronda', {
      options: opts(['Botiquín', 'Duchas y lavaojos', 'Almacenamiento de químicos', 'Carretillas elevadoras', 'Trabajos en altura'])
    }));
    fields.push(f('textarea', 'Observaciones generales', {
      placeholder: 'Comentarios, buenas prácticas observadas, compromisos adquiridos…'
    }));
    fields.push(f('file', 'Documentación adjunta', { multiple: true, maxFiles: 3 }));
    fields.push(f('signature', 'Firma del inspector', { required: true }));
    fields.push(f('signature', 'Firma del responsable de la zona'));

    return {
      id: Store.uid('form'),
      name: 'Ronda de seguridad — Inspección general',
      description: 'Plantilla de demostración con todos los módulos disponibles y un ejemplo de lógica condicional. Edítala o elimínala cuando montes las tuyas.',
      folderId: folderId,
      color: '#1E2B6F',
      icon: 'shield',
      emails: [],
      autoSend: false,
      fields: fields,
      archived: false
    };
  }

  /**
   * Se ejecuta una sola vez, en el primer arranque.
   * Las tipologías (gravedad, categorías, centros, áreas) se dejan vacías
   * a propósito: las define el usuario desde Ajustes.
   */
  function ensure() {
    var s = Store.settings();
    if (s.seeded) return false;

    // Con datos compartidos el cuestionario de ejemplo se crea una sola vez
    // para todos, y solo cuando ya se sabe qué hay en el servidor: si no, cada
    // dispositivo que arrancase vacío crearía el suyo y se duplicaría.
    if (global.Sync && Sync.enabled()) {
      if (!Sync.ready()) return false;
      if (Store.all('forms').length || Store.all('folders').length) {
        Store.saveSettings({ seeded: true });
        return false;
      }
      var role = null;
      try { role = (JSON.parse(localStorage.getItem('sr:auth') || 'null') || {}).role; } catch (e) {}
      if (role === 'inspector') return false;   // los inspectores no crean cuestionarios
    }

    var folder = Store.put('folders', {
      id: 'fol_inspecciones',
      name: 'Inspecciones periódicas',
      color: '#1E2B6F',
      order: 0
    });

    // Una tipología propia vacía, para que se vea desde el primer momento
    // cómo se usa el módulo de selección. Los elementos los pone el usuario.
    var resp = Store.addList({
      id: 'lst_responsables',
      name: 'Responsables de departamento',
      color: '#178A6B',
      icon: 'users',
      analysable: true
    });

    var demo = demoForm(folder.id, resp.id);
    demo.id = 'form_demo';
    Store.put('forms', demo);
    Store.saveSettings({ seeded: true });
    return true;
  }

  /* ======================================================================
     Datos de demostración (opcional, desde Ajustes)
     Genera tipologías, centros y un histórico de visitas para poder ver el
     dashboard funcionando sin tener que rellenar inspecciones a mano.
     ====================================================================== */

  function loadDemoData() {
    // Tipologías (solo se crean las que aún no existan)
    function ensureCatalog(type, entries) {
      entries.forEach(function (p, i) {
        var name = p[0], color = p[1];
        if (!Store.catalog(type).some(function (c) { return c.name === name; })) {
          Store.addCatalog(type, name, color);
        }
      });
    }

    ensureCatalog('severity', [['Crítica', '#E05C5C'], ['Alta', '#F16B6B'], ['Media', '#C77A10'], ['Baja', '#4356AE']]);
    ensureCatalog('category', [['EPIs', '#1E2B6F'], ['Orden y limpieza', '#2E3D8A'], ['Riesgo eléctrico', '#C77A10'],
      ['Protección contra incendios', '#E05C5C'], ['Máquinas y equipos', '#178A6B'], ['Señalización', '#6B4EA8']]);
    ensureCatalog('center', [['Planta principal', '#1E2B6F'], ['Almacén logístico', '#4356AE'], ['Oficinas', '#178A6B']]);

    function idOf(type, name) {
      var c = Store.catalog(type).filter(function (x) { return x.name === name; })[0];
      return c ? c.id : '';
    }

    // Áreas colgando de su centro: cada instalación tiene las suyas y solo
    // esas se ofrecen al elegirla. Es el caso de uso de la jerarquía.
    var AREAS_POR_CENTRO = {
      'Planta principal': [['Taller de mecanizado', '#4356AE'], ['Zona de pintura', '#C77A10'], ['Sala de calderas', '#E05C5C']],
      'Almacén logístico': [['Muelle de carga', '#178A6B'], ['Almacén de químicos', '#6B4EA8'], ['Zona de picking', '#4356AE']],
      'Oficinas': [['Recepción', '#178A6B'], ['Sala técnica', '#4356AE']]
    };
    Object.keys(AREAS_POR_CENTRO).forEach(function (centro) {
      var parentId = idOf('center', centro);
      if (!parentId) return;
      AREAS_POR_CENTRO[centro].forEach(function (p) {
        var exists = Store.catalog('area').some(function (c) {
          return c.name === p[0] && c.parentId === parentId;
        });
        if (!exists) Store.addCatalog('area', p[0], p[1], parentId);
      });
    });

    // Tipología propia con datos extra: al elegir a la persona, su correo se
    // propone como destinatario del informe.
    var respList = Store.lists().filter(function (l) { return /responsables/i.test(l.name); })[0];
    if (!respList) {
      respList = Store.addList({ name: 'Responsables de departamento', color: '#178A6B', icon: 'users', analysable: true });
    }
    [
      ['Nacho Moure', 'Jefe de Seguridad y Salud', 'nacho.moure@empresa.com'],
      ['Laura Freire Otero', 'Técnica de PRL', 'laura.freire@empresa.com'],
      ['Diego Sanmartín', 'Responsable de Mantenimiento', 'diego.sanmartin@empresa.com'],
      ['Marta Iglesias', 'Jefa de Almacén', 'marta.iglesias@empresa.com']
    ].forEach(function (p, i) {
      if (Store.listItems(respList.id).some(function (c) { return c.name === p[0]; })) return;
      Store.addItem(respList.id, {
        name: p[0], role: p[1], email: p[2],
        color: ['#178A6B', '#4356AE', '#C77A10', '#6B4EA8'][i % 4]
      });
    });

    var form = Store.all('forms')[0];
    if (!form) { ensure(); form = Store.all('forms')[0]; }
    var checkitems = (form.fields || []).filter(function (x) { return x.type === 'checkitem'; });
    if (!checkitems.length) return 0;

    var inspectores = ['Nacho Moure', 'Laura Freire', 'Diego Sanmartín'];
    var centros = ['Planta principal', 'Almacén logístico', 'Oficinas'];
    var sevs = ['Crítica', 'Alta', 'Media', 'Baja'];
    var cats = ['EPIs', 'Orden y limpieza', 'Riesgo eléctrico', 'Protección contra incendios', 'Máquinas y equipos', 'Señalización'];
    var descs = [
      'Se observa material apilado invadiendo parcialmente la vía de evacuación.',
      'Dos operarios sin protección auditiva en zona señalizada como obligatoria.',
      'Extintor descolgado y sin señalización vertical visible.',
      'Cuadro eléctrico abierto con cajas apoyadas delante impidiendo el acceso.',
      'Derrame de aceite no señalizado junto a la prensa hidráulica.',
      'Resguardo de la sierra de cinta retirado durante la operación.',
      'Salida de emergencia bloqueada con un palé de producto terminado.',
      'Señalización de suelo mojado ausente tras la limpieza del turno.'
    ];
    var accs = [
      'Retirar el material y reordenar el almacenamiento en la zona habilitada.',
      'Reponer EPIs y reforzar la formación en el uso obligatorio.',
      'Recolocar el extintor y reponer la señalización vertical.',
      'Cerrar el cuadro y despejar 1 metro de acceso libre.',
      'Limpiar el derrame y revisar la estanqueidad de la prensa.',
      'Reinstalar el resguardo y bloquear el equipo hasta su verificación.'
    ];

    var created = 0;
    var today = new Date();

    for (var m = 5; m >= 0; m--) {
      var perMonth = 2 + Math.floor(rnd() * 3);
      for (var k = 0; k < perMonth; k++) {
        var d = new Date(today.getFullYear(), today.getMonth() - m, 3 + Math.floor(rnd() * 24));
        if (d > today) continue;

        var answers = {};
        var ok = 0, ko = 0, na = 0;
        // La tasa de desviaciones mejora con el tiempo: la gráfica cuenta una historia
        var koRate = 0.30 - (5 - m) * 0.035;

        checkitems.forEach(function (ci) {
          var r = rnd();
          if (r < 0.05) { answers[ci.id] = { value: 'na', deviation: null }; na++; return; }
          if (r < 0.05 + koRate) {
            ko++;
            answers[ci.id] = {
              value: 'ko',
              deviation: {
                description: descs[Math.floor(rnd() * descs.length)],
                severityId: idOf('severity', sevs[Math.floor(rnd() * sevs.length)]),
                categoryId: idOf('category', cats[Math.floor(rnd() * cats.length)]),
                photos: [], files: [],
                action: {
                  title: accs[Math.floor(rnd() * accs.length)],
                  responsible: inspectores[Math.floor(rnd() * inspectores.length)],
                  dueDate: UI.fmtDateInput(new Date(d.getTime() + (7 + Math.floor(rnd() * 25)) * 86400000))
                }
              }
            };
            return;
          }
          ok++;
          answers[ci.id] = { value: 'ok', deviation: null };
        });

        // El área debe pertenecer al centro elegido, o la jerarquía mentiría
        var centerId = idOf('center', centros[Math.floor(rnd() * centros.length)]);
        var areasDelCentro = Store.catalog('area', centerId);
        var areaId = areasDelCentro.length
          ? areasDelCentro[Math.floor(rnd() * areasDelCentro.length)].id
          : '';

        // Respuestas de los campos no evaluables
        var dims = {};
        (form.fields || []).forEach(function (fl) {
          if (fl.type === 'fullname') answers[fl.id] = inspectores[Math.floor(rnd() * inspectores.length)];
          else if (fl.type === 'date') answers[fl.id] = UI.fmtDateInput(d);
          else if (fl.type === 'radio' && fl.options) answers[fl.id] = fl.options[Math.floor(rnd() * fl.options.length)].label;
          else if (fl.type === 'number') answers[fl.id] = String(68 + Math.floor(rnd() * 18));
          else if (fl.type === 'listpick' && fl.listId) {
            var opts = Store.listItems(fl.listId);
            if (!opts.length) return;
            var pickId = opts[Math.floor(rnd() * opts.length)].id;
            answers[fl.id] = { ids: [pickId], childId: '' };
            dims[fl.listId] = [pickId];
          }
        });

        if (centerId) dims[(Store.listBySystem('center') || {}).id] = [centerId];
        if (areaId) dims[(Store.listBySystem('area') || {}).id] = [areaId];

        var base = ok + ko;
        var visit = {
          id: Store.uid('vis'),
          formId: form.id,
          formName: form.name,
          folderId: form.folderId,
          formSnapshot: Store.clone(form),
          code: 'V' + d.getFullYear() + '-' + String(++created).padStart(4, '0'),
          centerId: centerId,
          areaId: areaId,
          dimensions: dims,
          inspector: inspectores[Math.floor(rnd() * inspectores.length)],
          date: UI.fmtDateInput(d),
          status: 'completed',
          completedAt: d.toISOString(),
          answers: answers,
          score: { ok: ok, ko: ko, na: na, total: base, pct: base ? Math.round(ok / base * 100) : 0 }
        };
        Store.put('visits', visit);
        Runner.syncDeviations(visit);
      }
    }

    // Cierra parte de las acciones antiguas para que el seguimiento tenga sentido
    Store.all('actions').forEach(function (a) {
      var age = UI.relativeDays(a.dueDate);
      if (age !== null && age < -20 && rnd() < 0.7) {
        a.status = 'done';
        a.closedAt = Store.nowISO();
        Store.put('actions', a);
        var dv = Store.get('deviations', a.deviationId);
        if (dv) { dv.status = 'closed'; Store.put('deviations', dv); }
      } else if (rnd() < 0.25) {
        a.status = 'progress';
        Store.put('actions', a);
      }
    });

    return created;
  }

  /* ======================================================================
     Demostración completa sobre los datos compartidos
     ----------------------------------------------------------------------
     La copia que ven las cuentas de demostración (demo-data.json: cuestionarios,
     plantas, visitas, desviaciones con fotos y plan de acción) cargada en el
     conjunto de datos que comparten la APP principal y la WebApp de campo, para
     tener algo que gestionar. Dos retoques al cargarla:
       · las fechas se reparten en las últimas semanas (la copia es de agosto y
         todo saldría vencido), de modo que hay desviaciones y acciones vencidas
         y otras por vencer;
       · se activa la periodicidad en tres cuestionarios, para que el
         calendario tenga rondas previstas.
     ====================================================================== */

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function dayAt(n) {                       // hoy menos n días, a mediodía (evita saltos de hora)
    var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d;
  }
  function parseDay(s) {
    var p = String(s).slice(0, 10).split('-');
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 12);
  }
  function fmtDay(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function shiftDay(s, delta) { if (!s) return s; var d = parseDay(s); d.setDate(d.getDate() + delta); return fmtDay(d); }
  function shiftISO(s, delta) { return s ? new Date(new Date(s).getTime() + delta * 86400000).toISOString() : s; }

  function redateDemo(data) {
    var visits = (data.visits || []).slice().sort(function (a, b) { return a.code < b.code ? -1 : a.code > b.code ? 1 : 0; });
    var delta = {};
    visits.forEach(function (v, i) {
      // La más reciente, hace 4 días; cada anterior, 6 días antes
      var target = dayAt(4 + (visits.length - 1 - i) * 6);
      delta[v.id] = Math.round((target - parseDay(v.date)) / 86400000);
    });
    (data.visits || []).forEach(function (v) {
      var d = delta[v.id] || 0;
      v.date = shiftDay(v.date, d);
      if (v.completedAt) v.completedAt = shiftISO(v.completedAt, d);
    });
    (data.deviations || []).forEach(function (x) {
      var d = delta[x.visitId] || 0;
      x.date = shiftDay(x.date, d);
      if (x.closedAt) x.closedAt = shiftISO(x.closedAt, d);
    });
    (data.actions || []).forEach(function (a) {
      var d = delta[a.visitId] || 0;
      if (a.dueDate) a.dueDate = shiftDay(a.dueDate, d);
      if (a.closedAt) a.closedAt = shiftISO(a.closedAt, d);
    });
    // Las acciones sin cerrar se reparten en el tiempo (una vencida, una de esta
    // semana, otras más adelante): así el calendario enseña los tres colores desde el primer día.
    var spread = [-1, 5, 16, 24];
    (data.actions || []).filter(function (a) { return a.status !== 'done' && a.dueDate; })
      .sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0; })
      .forEach(function (a, i) { if (i < spread.length) a.dueDate = fmtDay(dayAt(-spread[i])); });
  }

  function addDemoRecurrence(data) {
    var centerList = (data.lists || []).filter(function (l) { return l.system === 'center'; })[0];
    if (!centerList) return;
    var byName = {};
    (data.catalogs || []).forEach(function (c) { if (c.listId === centerList.id) byName[c.name] = c.id; });
    function ids(names) { return names.map(function (n) { return byName[n]; }).filter(Boolean); }

    (data.forms || []).forEach(function (f) {
      if (f.recurrence) return;
      var plan = null;
      if (/^Ronda de seguridad/i.test(f.name)) plan = ['monthly', ['Barcelona', 'Tarragona']];
      else if (/Carretillas/i.test(f.name)) plan = ['monthly', ['Algeciras', 'Valencia']];
      else if (/^OPS/i.test(f.name) && !/copia/i.test(f.name)) plan = ['biweekly', ['Barcelona', 'Tarragona', 'Algeciras', 'Valencia']];
      if (!plan) return;
      var c = ids(plan[1]);
      if (c.length) f.recurrence = { enabled: true, freq: plan[0], customDays: 30, centerIds: c };
    });

    // Primera ronda de cada cuestionario y planta que todavía no tiene visitas hechas:
    // repartidas en las próximas semanas (una ya con retraso), en vez de todas hoy.
    var offsets = [-3, 2, 5, 9, 12, 16, 21, 26], n = 0;
    (data.forms || []).forEach(function (f) {
      if (!f.recurrence || !f.recurrence.enabled) return;
      f.recurrence.startDates = f.recurrence.startDates || {};
      f.recurrence.centerIds.forEach(function (cid) {
        var done = (data.visits || []).some(function (v) { return v.formId === f.id && v.centerId === cid && v.status === 'completed'; });
        if (done) return;
        f.recurrence.startDates[cid] = fmtDay(dayAt(-offsets[n++ % offsets.length]));
      });
    });
  }

  /**
   * Sustituye los datos compartidos por la demostración completa (los ajustes
   * generales no se tocan) y lo anota en los ajustes compartidos para que no
   * vuelva a cargarse sola. Devuelve una promesa.
   */
  function loadSharedDemo(opts) {
    var local = !!(opts && opts.local);
    return fetch('/demo-data.json', { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('No se ha podido descargar la copia de demostración.');
      return res.json();
    }).then(function (data) {
      redateDemo(data);
      addDemoRecurrence(data);
      Store.importAll(data, true, { keepSettings: true });
      Store.saveSettings({ seeded: true, demoLoadedAt: Store.nowISO() });
      // Demostración propia de este navegador (cuenta de demostración, sin servidor): si
      // más tarde entra aquí una cuenta real, su primera sincronización guarda estos datos
      // aparte y empieza con los del servidor, en vez de subirlos a los datos reales.
      if (local) { try { localStorage.setItem('sr:presync', '1'); } catch (e) {} }
      return true;
    });
  }

  /**
   * Cuenta de demostración: carga los datos de ejemplo la primera vez que entra en
   * este navegador. Safety Desk y Safety Go leen del mismo almacenamiento del
   * navegador, así que los dos ven lo mismo (y lo que se haga en uno se ve en el otro).
   */
  function ensureLocalDemo() {
    var role = null;
    try { role = (JSON.parse(localStorage.getItem('sr:auth') || 'null') || {}).role; } catch (e) {}
    if (role !== 'usuario' || Store.settings().seeded) return Promise.resolve(false);
    return loadSharedDemo({ local: true }).then(function () { return true; }).catch(function (e) {
      console.warn('[seed] no se ha podido cargar la demostración', e);
      return false;
    });
  }

  /** ¿Los datos compartidos están en blanco (a lo sumo, el cuestionario de bienvenida)? */
  function sharedIsPristine() {
    return !Store.all('visits').length && !Store.all('deviations').length && !Store.all('actions').length &&
      Store.all('forms').every(function (f) { return f.id === 'form_demo'; });
  }

  /**
   * La primera vez que un administrador o supervisor entra con los datos
   * compartidos en blanco, se carga la demostración: así la WebApp de campo
   * tiene qué gestionar desde el primer momento. No se repite si ya se cargó
   * una vez o si hay datos propios (el botón de Ajustes sirve para forzarla).
   */
  function ensureSharedDemo() {
    var role = null;
    try { role = (JSON.parse(localStorage.getItem('sr:auth') || 'null') || {}).role; } catch (e) {}
    if (['admin', 'supervisor'].indexOf(role) === -1) return Promise.resolve(false);
    if (!global.Sync || !Sync.enabled() || !Sync.ready()) return Promise.resolve(false);
    var st = Sync.status().status;
    if (navigator.onLine === false || st === 'offline' || st === 'auth' || st === 'error') return Promise.resolve(false);
    if (Store.settings().demoLoadedAt || !sharedIsPristine()) return Promise.resolve(false);
    return loadSharedDemo().then(function () { return true; }).catch(function (e) {
      console.warn('[seed] no se ha podido cargar la demostración compartida', e);
      return false;
    });
  }

  // Generador pseudoaleatorio con semilla: los datos de ejemplo son
  // reproducibles, lo que hace que las capturas y pruebas sean consistentes.
  var _seed = 20260725;
  function rnd() {
    _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
    return _seed / 0x7fffffff;
  }

  global.Seed = {
    ensure: ensure, loadDemoData: loadDemoData, demoForm: demoForm,
    loadSharedDemo: loadSharedDemo, ensureSharedDemo: ensureSharedDemo, ensureLocalDemo: ensureLocalDemo
  };
})(window);
