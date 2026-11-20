/* Факты по мышцам для упражнения «Мышцы в действии».
   Источник текста — М. Г. Привес, «Анатомия человека»; сегменты спинного мозга — Р. Д. Синельников, т. 1.
   muscles[termId] = { o: начало, i: прикрепление, f: функция, n: id нерва, seg?: сегменты, src: где прочитать }
   moves[] = движения и мышцы, которые их выполняют (m), x — мышцы-помощники, их не берём в неверные варианты */
const MYO_FACTS = {
  m_shoulder: {
    nerves: {
      n_musculocutaneus: { lat: 'n. musculocutaneus', ru: 'мышечно-кожный нерв' },
      n_radialis: { lat: 'n. radialis', ru: 'лучевой нерв' },
      n_axillaris: { lat: 'n. axillaris', ru: 'подмышечный нерв' },
      n_suprascapularis: { lat: 'n. suprascapularis', ru: 'надлопаточный нерв' },
      n_subscapularis: { lat: 'n. subscapularis', ru: 'подлопаточный нерв' },
      n_thoracodorsalis: { lat: 'n. thoracodorsalis', ru: 'грудоспинной нерв' },
      n_medianus: { lat: 'n. medianus', ru: 'срединный нерв' }
    },
    muscles: {
      musculus_deltoideus: { o: 'латеральная треть ключицы, акромион, ость лопатки', i: 'дельтовидная бугристость плечевой кости', f: 'передняя часть сгибает плечо, задняя разгибает, средняя (вся мышца) отводит руку до горизонтали', n: 'n_axillaris', seg: 'CV–CVI', src: 'Привес, с. 222–225' },
      musculus_supraspinatus: { o: 'надостная ямка лопатки', i: 'верхняя часть большого бугорка плечевой кости', f: 'отводит плечо (синергист дельтовидной), натягивает капсулу сустава', n: 'n_suprascapularis', seg: 'CV–CVI', src: 'Привес, с. 222–225' },
      musculus_infraspinatus: { o: 'подостная ямка лопатки', i: 'большой бугорок плечевой кости', f: 'вращает плечо кнаружи', n: 'n_suprascapularis', seg: 'CV–CVI', src: 'Привес, с. 222–225' },
      musculus_teres_minor: { o: 'латеральный край лопатки', i: 'большой бугорок плечевой кости, ниже сухожилия подостной', f: 'вращает плечо кнаружи (как подостная)', n: 'n_axillaris', seg: 'CV–CVI', src: 'Привес, с. 222–225' },
      musculus_teres_major: { o: 'задняя поверхность нижнего угла лопатки', i: 'гребень малого бугорка плечевой кости (вместе с широчайшей)', f: 'тянет руку назад и вниз, приводит, вращает плечо внутрь', n: 'n_subscapularis', seg: 'CV–CVII', src: 'Привес, с. 222–225' },
      musculus_subscapularis: { o: 'рёберная поверхность лопатки (вся)', i: 'малый бугорок плечевой кости', f: 'вращает плечо внутрь, натягивает капсулу сустава', n: 'n_subscapularis', seg: 'CV–CVII', src: 'Привес, с. 222–225' },
      musculus_latissimus_dorsi: { o: 'остистые отростки нижних грудных, всех поясничных и крестцовых позвонков, задняя часть гребня подвздошной кости, нижние рёбра', i: 'гребень малого бугорка плечевой кости', f: 'разгибает и вращает плечо внутрь, приводит отведённую руку; при фиксированных руках подтягивает туловище', n: 'n_thoracodorsalis', src: 'Привес, с. 193–194' },
      musculus_coracobrachialis: { o: 'клювовидный отросток лопатки', i: 'медиальная поверхность плечевой кости ниже гребня малого бугорка', f: 'сгибает и приводит плечо', n: 'n_musculocutaneus', seg: 'CV–CVII', src: 'Привес, с. 222–225' },
      musculus_biceps_brachii: { o: 'длинная головка — надсуставной бугорок лопатки; короткая — клювовидный отросток', i: 'бугристость лучевой кости; апоневроз — в фасцию предплечья', f: 'сгибает плечо и предплечье, супинирует предплечье', n: 'n_musculocutaneus', seg: 'CV–CVII', src: 'Привес, с. 222–225' },
      musculus_brachialis: { o: 'передняя поверхность плечевой кости и обе межмышечные перегородки', i: 'бугристость локтевой кости', f: 'только сгибает предплечье', n: 'n_musculocutaneus', seg: 'CV–CVII', src: 'Привес, с. 222–225' },
      musculus_triceps_brachii: { o: 'длинная головка — подсуставной бугорок лопатки; латеральная и медиальная — задняя поверхность плечевой кости', i: 'локтевой отросток (olecranon)', f: 'разгибает предплечье; длинная головка разгибает и приводит плечо', n: 'n_radialis', seg: 'CV–CVIII', src: 'Привес, с. 222–225' },
      musculus_anconeus: { o: 'латеральный надмыщелок плечевой кости и лучевая коллатеральная связка', i: 'задняя поверхность локтевой кости (проксимальная четверть)', f: 'разгибает предплечье (как трёхглавая)', n: 'n_radialis', seg: 'CVI–CVIII', src: 'Привес, с. 222–225' },
      musculus_brachioradialis: { o: 'латеральный край плечевой кости', i: 'лучевая кость выше шиловидного отростка', f: 'сгибает предплечье, устанавливает лучевую кость в среднее положение', n: 'n_radialis', src: 'Привес, с. 222–225' },
      musculus_pronator_teres: { o: 'медиальный надмыщелок плечевой кости и бугристость локтевой кости', i: 'латеральная поверхность лучевой кости чуть выше середины', f: 'пронирует предплечье, помогает сгибать', n: 'n_medianus', src: 'Привес, с. 222–225' }
    },
    moves: [
      { id: 'flex_forearm', t: 'Сгибание предплечья в локтевом суставе', m: ['musculus_biceps_brachii', 'musculus_brachialis', 'musculus_brachioradialis'], x: ['musculus_pronator_teres'], src: 'Привес, с. 222–225' },
      { id: 'ext_forearm', t: 'Разгибание предплечья в локтевом суставе', m: ['musculus_triceps_brachii', 'musculus_anconeus'], x: [], src: 'Привес, с. 222–225' },
      { id: 'flex_arm', t: 'Сгибание плеча', m: ['musculus_deltoideus', 'musculus_biceps_brachii', 'musculus_coracobrachialis'], x: [], src: 'Привес, с. 222–225' },
      { id: 'ext_arm', t: 'Разгибание плеча', m: ['musculus_deltoideus', 'musculus_latissimus_dorsi', 'musculus_teres_major', 'musculus_triceps_brachii'], x: [], src: 'Привес, с. 193–194, 222–225' },
      { id: 'abd_arm', t: 'Отведение плеча', m: ['musculus_deltoideus', 'musculus_supraspinatus'], x: [], src: 'Привес, с. 222–225' },
      { id: 'add_arm', t: 'Приведение плеча', m: ['musculus_latissimus_dorsi', 'musculus_teres_major', 'musculus_coracobrachialis', 'musculus_triceps_brachii'], x: [], src: 'Привес, с. 193–194, 222–225' },
      { id: 'rot_out', t: 'Вращение плеча кнаружи', m: ['musculus_infraspinatus', 'musculus_teres_minor'], x: [], src: 'Привес, с. 222–225' },
      { id: 'rot_in', t: 'Вращение плеча внутрь', m: ['musculus_subscapularis', 'musculus_teres_major', 'musculus_latissimus_dorsi'], x: [], src: 'Привес, с. 193–194, 222–225' }
    ]
  }
};
