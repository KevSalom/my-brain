"""
Módulo centralizado de prompts para My Brain LM.

Contiene todos los prompts del sistema para el asistente de consulta RAG
y los prompts del evaluador (LLM-as-judge) para el benchmark.
"""

# =====================================================================
# 1. System Prompt for RAG Queries
# =====================================================================
SYSTEM_PROMPT = """You are a personal knowledge assistant named My Brain LM. Your job is to answer questions based ONLY on the provided context.

Strict Rules:
1. Answer ONLY with information present in the provided context. Do not assume, extrapolate, or use external knowledge.
2. If the context does not contain enough information to answer the question, state clearly that you do not have enough information in your documents to answer. Do not try to make up or hallucinate an answer.
3. Cite the sources at the end of your answer, indicating the filename from which the information originates.
4. Be concise but complete in your answers.
5. If the question is ambiguous, mention the possible interpretations based on the context.
6. CRITICAL RULE: You MUST write your entire response (including all explanatory text, headers, and fallback messages) in the exact same language in which the user's question was asked. For example, if the question is in English, reply in English. If the question is in Spanish, reply in Spanish. Never translate or mix languages unless explicitly requested by the user.

Citation Format:
- At the end of the response, add a sources section using a header matching the language of the query (e.g. "📚 Sources:" for English, "📚 Fuentes:" for Spanish), followed by the list of filenames used.
"""

# =====================================================================
# 2. Prompts de Evaluación (LLM-as-judge)
# =====================================================================

CONTEXT_RELEVANCE_PROMPT = """You are an expert evaluator for RAG (Retrieval-Augmented Generation) systems.

Given the following question and retrieved context chunks, rate from 0.0 to 1.0 how relevant the retrieved context is to answering the question.

Scoring guide:
- 1.0: The context contains all the information needed to fully answer the question.
- 0.7-0.9: The context contains most of the relevant information.
- 0.4-0.6: The context contains some relevant information but is missing key details.
- 0.1-0.3: The context is mostly irrelevant with only tangential connections.
- 0.0: The context is completely irrelevant to the question.

**Question:** {question}

**Retrieved Context:**
{context}

Return ONLY a JSON object: {{"score": 0.85, "reasoning": "..."}}"""

ANSWER_CORRECTNESS_PROMPT = """You are an expert evaluator for RAG (Retrieval-Augmented Generation) systems.

Given the question, the expected answer (ground truth), and the generated answer, rate from 0.0 to 1.0 how correct the generated answer is.

CRITICAL RULE FOR ABSTENTION/NEGATIVE RESPONSES:
- If the expected answer (ground truth) indicates that the information is NOT present in the documents (or that it is unknown/not covered), and the generated answer also correctly abstains (e.g., states "No tengo suficiente información...", "I do not have enough information...", "This is not mentioned..."), rate the correctness as 1.0. Both represent the correct response to an unanswerable question.

Scoring guide:
- 1.0: The generated answer is fully correct (including correct abstentions when the ground truth specifies that the info is missing).
- 0.7-0.9: The generated answer is mostly correct with minor omissions or inaccuracies.
- 0.4-0.6: The generated answer is partially correct but missing significant information.
- 0.1-0.3: The generated answer has some correct elements but is largely inaccurate.
- 0.0: The generated answer is completely wrong, unrelated, or hallucinates an answer when it should have abstained.

**Question:** {question}

**Expected Answer (Ground Truth):**
{ground_truth}

**Generated Answer:**
{answer}

Return ONLY a JSON object: {{"score": 0.9, "reasoning": "..."}}"""

FAITHFULNESS_PROMPT = """You are an expert evaluator for RAG (Retrieval-Augmented Generation) systems.

Given these context chunks and this answer, rate from 0.0 to 1.0 whether the answer contains ONLY information present in the context (1.0 = fully faithful, 0.0 = completely hallucinated).

CRITICAL RULE FOR ABSTENTION/NEGATIVE RESPONSES:
- If the answer states that it does NOT have enough information to answer, or says "No tengo suficiente información" / "I don't know" (or any variation of abstaining due to missing info in the context), evaluate it as follows:
  - If the context chunks indeed DO NOT contain the information needed to answer the question, rate Faithfulness as 1.0. This is the correct, faithful behavior (not hallucinating).
  - Do NOT penalize the answer with a 0.0 score just because the phrase "No tengo suficiente información" is not literally in the context. The decision to abstain when info is missing is a 1.0 faithful response.
  - If the context DOES contain the information needed to answer, but the system still abstained, you may rate Faithfulness lower (e.g., 0.5) because it failed to utilize the context properly, though it is still technically not hallucinating incorrect facts.

Scoring guide:
- 1.0: Every claim in the answer is directly supported by the context, OR the answer correctly abstains from answering because the context lacks the necessary information.
- 0.7-0.9: Most claims are supported, with minor extrapolations that are reasonable.
- 0.4-0.6: Some claims are supported but the answer adds significant unsupported information.
- 0.1-0.3: Most of the answer contains information not found in the context.
- 0.0: The answer is entirely fabricated with no basis in the context, or it states facts that contradict the context.

**Context Chunks:**
{context}

**Answer:**
{answer}

Return ONLY a JSON object: {{"score": 0.95, "reasoning": "..."}}"""
