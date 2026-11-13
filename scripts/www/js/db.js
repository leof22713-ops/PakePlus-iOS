/**
 * 纯前端本地存储层 (基于 localStorage)
 * 包含间隔重复调度算法与严格的导入逻辑
 */
(function () {
  const STORAGE_KEY = "vocab_data";
  const DAY = 24 * 60 * 60 * 1000; // 1天的毫秒数

  // 初始化并兼容老数据
  async function init() {
    console.log("本地存储 (localStorage) 已就绪");
    let data = getAll();
    let needSave = false;

    // 兼容旧数据：如果没有 nextReviewTime 字段，默认设为 0（立刻可复习）
    data.forEach(item => {
      if (item.nextReviewTime === undefined) {
        item.nextReviewTime = 0;
        needSave = true;
      }
    });

    if (needSave) saveAll(data);
  }

  // 获取所有数据
  function getAll() {
    const str = localStorage.getItem(STORAGE_KEY);
    return str ? JSON.parse(str) : [];
  }

  // 保存所有数据
  function saveAll(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // 新增
  function add(eng, chi) {
    const data = getAll();
    const newId = data.length > 0 ? Math.max(...data.map(d => d.id)) + 1 : 1;
    data.push({
      id: newId,
      eng: eng,
      chi: chi,
      studyTime: 0,
      nextReviewTime: 0, // 0 表示立刻可以复习
      createTime: new Date().toLocaleString()
    });
    saveAll(data);
  }

  // 更新（支持更新熟练度）
  function update(id, eng, chi, studyTime) {
    const data = getAll();
    const item = data.find(d => d.id === id);
    if (item) {
      item.eng = eng;
      item.chi = chi;
      // 如果传入了 studyTime，则更新它
      if (studyTime !== undefined && studyTime !== null) {
        item.studyTime = parseInt(studyTime, 10) || 0;
      }
      saveAll(data);
    }
  }

  // 删除
  function del(id) {
    let data = getAll();
    data = data.filter(d => d.id !== id);
    saveAll(data);
  }

  // 更新复习状态（核心公式计算）
  function updateStudy(id, type) {
    const data = getAll();
    const item = data.find(d => d.id === id);
    if (!item) return;

    const now = Date.now();

    if (type === 'forget') {
      // 熟练度减 1，但最低不能小于 0
      item.studyTime = Math.max(0, (item.studyTime || 0) - 1);
      // 设为当前时间，由于是升序排列，它会自然排到今天所有旧词的最后
      item.nextReviewTime = now; 
    } else if (type === 'vague') {
      // 熟练度不变，1天后再见
      item.nextReviewTime = now + 1 * DAY; 
    } else if (type === 'know') {
      item.studyTime = (item.studyTime || 0) + 1;
      
      // 认识：按照熟练度，按天数阶梯增加
      let intervalDays = 1;
      if (item.studyTime === 1) intervalDays = 1;      // 第1次认识：1天后
      else if (item.studyTime === 2) intervalDays = 2; // 第2次：2天后
      else if (item.studyTime === 3) intervalDays = 4; // 第3次：4天后
      else if (item.studyTime === 4) intervalDays = 7; // 第4次：7天后
      else if (item.studyTime === 5) intervalDays = 15;// 第5次：15天后
      else intervalDays = 30;                          // 5次以上：默认30天后
      
      item.nextReviewTime = now + intervalDays * DAY;
    }

    saveAll(data);
  }

  // 获取下一条需要复习的单词（严格模式，没到期坚决不拿）
  function getReviewWord() {
    const data = getAll();
    const now = Date.now();
    
    // 过滤出所有到期的（nextReviewTime <= 当前时间）
    const dueWords = data.filter(d => d.nextReviewTime <= now);
    
    if (dueWords.length === 0) return null;

    // 纯粹按时间升序排列（谁过期最久，谁排最前）
    dueWords.sort((a, b) => a.nextReviewTime - b.nextReviewTime);
    
    return dueWords[0];
  }

  // 导出为 JSON 字符串
  function exportJSON() {
    return JSON.stringify(getAll(), null, 2);
  }

  // 导入合并（严格跳过已存在的 ENG+CHI）
  function importJSON(jsonStr) {
    let importData;
    try {
      importData = JSON.parse(jsonStr);
      if (!Array.isArray(importData)) throw new Error("数据格式不正确，应为数组");
    } catch (e) {
      throw new Error("解析文件失败: " + e.message);
    }

    const currentData = getAll();
    let insertCount = 0;

    importData.forEach(imp => {
      // 兼容大小写
      const eng = imp.eng || imp.ENG;
      const chi = imp.chi || imp.CHI;
      if (!eng || !chi) return; // 跳过无效数据

      // 严格匹配：只要存在相同的 ENG 和 CHI，直接跳过，不作任何更新
      const exist = currentData.find(d => d.eng === eng && d.chi === chi);
      if (exist) {
        return; 
      }

      // 不存在，插入新词
      const newId = currentData.length > 0 ? Math.max(...currentData.map(d => d.id)) + 1 : 1;
      currentData.push({
        id: newId,
        eng: eng,
        chi: chi,
        studyTime: 0,
        nextReviewTime: 0,
        createTime: new Date().toLocaleString()
      });
      insertCount++;
    });

    saveAll(currentData);
    return { insertCount };
  }

  // 暴露给全局变量
  window.AppDB = {
    init,
    getAll,
    add,
    update,
    del,
    updateStudy,
    getReviewWord,
    exportJSON,
    importJSON
  };
})();