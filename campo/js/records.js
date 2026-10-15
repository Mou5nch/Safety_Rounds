/* ==========================================================================
   Safety Rounds · Campo — Operaciones sobre desviaciones y acciones
   --------------------------------------------------------------------------
   La desviación y su acción correctora nacen de la respuesta «No correcto» de
   una visita (Runner.syncDeviations las reconstruye cada vez que se vuelve a
   guardar la visita). Si desde campo se edita la descripción, la gravedad, las
   fotos o la acción, hay que escribir el cambio TAMBIÉN en la respuesta de la
   visita: de lo contrario, la próxima vez que alguien reabra y guarde esa
   visita, el cambio se revertiría sin avisar.
   El estado (abierta/cerrada, en curso…) no existe en la visita, así que
   esos cambios no la tocan.
   ========================================================================== */
(function (global) {
  'use strict';

  function actionOf(dev) {
    return Store.query('actions', function (a) { return a.deviationId === dev.id; })[0] || null;
  }

  /** Respuesta de la visita que dio origen a la desviación (o null si ya no existe). */
  function sourceAnswer(dev) {
    var v = Store.get('visits', dev.visitId);
    if (!v || !v.answers) return null;
    var a = v.answers[dev.fieldId];
    if (!a || a.value !== 'ko') return null;
    a.deviation = a.deviation || { description: '', severityId: '', categoryId: '', photos: [], files: [], action: { title: '', responsible: '', dueDate: '' } };
    return { visit: v, answer: a, dev: a.deviation };
  }

  function saveVisit(v) { Store.put('visits', v); }

  /* ---------- Desviación ---------- */

  /** patch: description, severityId, categoryId. Se refleja en el registro y en la visita. */
  function saveDeviation(dev, patch) {
    Object.keys(patch).forEach(function (k) { dev[k] = patch[k]; });
    Store.put('deviations', dev);

    var src = sourceAnswer(dev);
    if (src) {
      ['description', 'severityId', 'categoryId'].forEach(function (k) {
        if (k in patch) src.dev[k] = patch[k];
      });
      saveVisit(src.visit);
    }

    // La gravedad y la categoría también viajan en la acción (el dashboard filtra por ellas)
    var act = actionOf(dev);
    if (act && ('severityId' in patch || 'categoryId' in patch || 'description' in patch)) {
      if ('severityId' in patch) act.severityId = patch.severityId;
      if ('categoryId' in patch) act.categoryId = patch.categoryId;
      if ('description' in patch) act.description = patch.description;
      Store.put('actions', act);
    }
    return dev;
  }

  function setDeviationClosed(dev, closed) {
    dev.status = closed ? 'closed' : 'open';
    dev.closedAt = closed ? Store.nowISO() : null;
    Store.put('deviations', dev);
    // Mismo criterio que la APP principal: cerrar la desviación cierra su acción
    var act = actionOf(dev);
    if (act) {
      act.status = closed ? 'done' : (act.status === 'done' ? 'open' : act.status);
      act.closedAt = closed ? Store.nowISO() : null;
      Store.put('actions', act);
    }
  }

  function addPhoto(dev, dataURL) {
    dev.photos = (dev.photos || []).concat([dataURL]);
    Store.put('deviations', dev);
    var src = sourceAnswer(dev);
    if (src) {
      src.dev.photos = (src.dev.photos || []).concat([{ kind: 'image', name: 'campo.jpg', data: dataURL }]);
      saveVisit(src.visit);
    }
  }

  function removePhoto(dev, index) {
    var arr = (dev.photos || []).slice();
    var removed = arr.splice(index, 1)[0];
    dev.photos = arr;
    Store.put('deviations', dev);
    var src = sourceAnswer(dev);
    if (src && removed) {
      var list = (src.dev.photos || []).slice();
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].kind === 'image' && list[i].data === removed) { list.splice(i, 1); break; }
      }
      src.dev.photos = list;
      saveVisit(src.visit);
    }
  }

  /** Elimina la desviación y su acción. La visita conserva su respuesta «No correcto». */
  function deleteDeviation(dev) {
    var act = actionOf(dev);
    if (act) Store.remove('actions', act.id);
    Store.remove('deviations', dev.id);
  }

  /* ---------- Acción correctora ---------- */

  /** patch: title, responsible, dueDate, notes, status. */
  function saveAction(act, patch) {
    Object.keys(patch).forEach(function (k) { act[k] = patch[k]; });
    if ('status' in patch) act.closedAt = act.status === 'done' ? Store.nowISO() : null;
    Store.put('actions', act);

    // Cerrar la acción cierra su desviación (y reabrirla, la reabre)
    if ('status' in patch) {
      var dev = Store.get('deviations', act.deviationId);
      if (dev) {
        var shouldClose = act.status === 'done';
        if ((dev.status === 'closed') !== shouldClose) {
          dev.status = shouldClose ? 'closed' : 'open';
          dev.closedAt = shouldClose ? Store.nowISO() : null;
          Store.put('deviations', dev);
        }
      }
    }

    // Título, responsable y fecha viven también en la respuesta de la visita
    if ('title' in patch || 'responsible' in patch || 'dueDate' in patch) {
      var dv = Store.get('deviations', act.deviationId);
      var src = dv ? sourceAnswer(dv) : null;
      if (src) {
        src.dev.action = src.dev.action || { title: '', responsible: '', dueDate: '' };
        if ('title' in patch) src.dev.action.title = patch.title;
        if ('responsible' in patch) src.dev.action.responsible = patch.responsible;
        if ('dueDate' in patch) src.dev.action.dueDate = patch.dueDate;
        saveVisit(src.visit);
      }
    }
    return act;
  }

  /** Crea la acción de una desviación que no la tenía. */
  function createAction(dev, data) {
    var act = {
      id: Store.uid('act'), status: 'open', notes: '',
      deviationId: dev.id, visitId: dev.visitId, visitCode: dev.visitCode,
      title: data.title || dev.question, responsible: data.responsible || '', dueDate: data.dueDate || '',
      severityId: dev.severityId, categoryId: dev.categoryId, centerId: dev.centerId, areaId: dev.areaId,
      description: dev.description
    };
    Store.put('actions', act);
    var src = sourceAnswer(dev);
    if (src) {
      src.dev.action = { title: act.title, responsible: act.responsible, dueDate: act.dueDate };
      saveVisit(src.visit);
    }
    return act;
  }

  global.Records = {
    actionOf: actionOf,
    saveDeviation: saveDeviation,
    setDeviationClosed: setDeviationClosed,
    addPhoto: addPhoto,
    removePhoto: removePhoto,
    deleteDeviation: deleteDeviation,
    saveAction: saveAction,
    createAction: createAction
  };
})(window);
