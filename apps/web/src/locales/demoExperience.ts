export const demoExperienceZh = {
  title: '问得清楚，答有所据。',
  description: 'Avenlo 虚构消费电子商家 · 查询产品与政策，核对来源，或体验模拟订单。',
  fictional: '虚构商家 · 模拟数据',
  welcomeKicker: '从一个真实资料问题开始',
  fillOnly: '点击示例只填入问题，由你确认发送。',
  tabsLabel: '问答与资料',
  chatTab: '问答',
  evidenceTab: '资料与结果',
  backToChat: '返回当前问答',
  transcript: '客服会话记录',
  sourceNumber: '查看来源 {number}',
  answerNumber: '回答 {number}',
  viewOutcome: '查看资料与结果',
  restoreQuestion: '把原问题放回输入框',
  failureNotice: '内容可能不完整；重新发送前请核对，避免重复申请人工处理。',
  receiving: '等待服务返回',
  feedbackSaved: '反馈已保存',
  newContent: '有新内容 · 回到底部',
  requestNotice: '服务提示',
  draftWhileWaiting: '正在等待回复，你可以先起草下一条问题。',
  composerHint: 'Ctrl / ⌘ + Enter 发送 · Shift + Enter 换行',
  evidenceHint: '点击回答中的来源编号，查看对应原文。',
  sourceDisclaimer: '以下为服务返回的相关来源；存在引用不等于每个结论都正确，请核对原文。',
  checkedDisclaimer: '以下来源已被检查，但不足以回答当前问题；它们不代表问题已有结论。',
  page: '第 {page} 页',
  handoffNotice: '服务已确认创建人工工单，等待客服处理。这不代表真人已在线，也没有自动退款。',
  handoffUnconfirmed: '现有资料不足；本条消息未确认工单创建成功，请勿视为已经转接。',
  loadingShort: '加载中',
  unavailable: '暂不可用',
  orderNumber: '订单号',
  orderStatus: '订单状态',
  eligibility: '退货资格',
  policyVersion: '政策版本',
  returnStatus: {
    eligible: '符合申请条件',
    ineligible: '不符合申请条件',
    manual_review: '需要人工审核',
  },
  toolStatus: {
    succeeded: '查询完成',
    not_found: '订单未找到',
    email_mismatch: '邮箱不匹配',
    failed: '工具失败',
  },
  evidenceState: {
    initial: {
      title: '回答与原文，在这里对照',
      description: '先发送一个问题。产品与政策回答会显示引用；模拟订单则会显示受控工具结果。',
    },
    pending: {
      title: '来源还未返回',
      description: '当前问题正在处理。引用和工具结果将在服务返回后更新，不提前展示结论。',
    },
    failed: {
      title: '本次请求未完成',
      description: '服务没有确认完整结果。即使已有部分内容，也不能据此认为回答或人工接管已完成。',
    },
    none: {
      title: '这条回答没有返回引用',
      description:
        '可能是工具结果、资料不足或未提供来源。请结合下方状态核对，不把无引用当作已验证。',
    },
  },
}

export const demoExperienceEn = {
  title: 'A clear question. A verifiable answer.',
  description:
    'Avenlo is a fictional electronics merchant. Ask about products and policies, inspect sources, or try a simulated order.',
  fictional: 'Fictional merchant · Simulated data',
  welcomeKicker: 'START WITH A QUESTION THE SOURCES CAN ANSWER',
  fillOnly: 'Examples fill your draft. You decide when to send.',
  tabsLabel: 'Conversation and evidence',
  chatTab: 'Conversation',
  evidenceTab: 'Evidence',
  backToChat: 'Back to the conversation',
  transcript: 'Support conversation',
  sourceNumber: 'View source {number}',
  answerNumber: 'Answer {number}',
  viewOutcome: 'View evidence and outcome',
  restoreQuestion: 'Restore the question to the composer',
  failureNotice:
    'This result may be incomplete. Review before resending to avoid duplicate handoff requests.',
  receiving: 'Waiting for the service',
  feedbackSaved: 'Feedback saved',
  newContent: 'New content · Jump to latest',
  requestNotice: 'Service notice',
  draftWhileWaiting: 'Waiting for a reply. You can draft your next question.',
  composerHint: 'Ctrl / ⌘ + Enter to send · Shift + Enter for a new line',
  evidenceHint: 'Select a source number in an answer to inspect the excerpt.',
  sourceDisclaimer:
    'These are related sources returned by the service. A citation alone does not prove every claim; compare the original text.',
  checkedDisclaimer:
    'These sources were checked but could not answer this question. They do not establish a conclusion.',
  page: 'Page {page}',
  handoffNotice:
    'The service confirmed a human-review ticket. It is awaiting support, not a live human reply. No refund was issued.',
  handoffUnconfirmed:
    'The sources are insufficient. This message did not confirm a ticket was created; do not assume the handoff succeeded.',
  loadingShort: 'Loading',
  unavailable: 'Unavailable',
  orderNumber: 'Order number',
  orderStatus: 'Order status',
  eligibility: 'Return eligibility',
  policyVersion: 'Policy version',
  returnStatus: {
    eligible: 'Eligible to apply',
    ineligible: 'Not eligible',
    manual_review: 'Human review needed',
  },
  toolStatus: {
    succeeded: 'Completed',
    not_found: 'Order not found',
    email_mismatch: 'Email does not match',
    failed: 'Tool failed',
  },
  evidenceState: {
    initial: {
      title: 'Compare the answer with its sources',
      description:
        'Send a question to begin. Product and policy answers show citations; simulated orders show controlled tool results.',
    },
    pending: {
      title: 'Sources have not arrived yet',
      description:
        'The service is processing this question. Evidence and tool results appear only when returned, not ahead of time.',
    },
    failed: {
      title: 'This request did not complete',
      description:
        'The service did not confirm a complete result. Partial content does not confirm a finished answer or human handoff.',
    },
    none: {
      title: 'No citations were returned for this answer',
      description:
        'This may be a tool result, insufficient evidence, or an answer without sources. Check the outcome below; do not treat it as verified.',
    },
  },
}
