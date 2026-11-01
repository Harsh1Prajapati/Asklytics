# Asklytics Transformation Plan
## Production-Quality AI-Powered Financial Analytics Platform

**Date:** 2026-11-01
**Status:** In Progress

---

## Executive Summary

This document outlines the systematic transformation of Asklytics from a template-driven system with hardcoded responses to an intelligent, dynamic, question-driven financial analytics platform.

## Root Causes Identified

### 1. Frontend Mock Data (CRITICAL)
**Location:** `web/src/app/pages/chat.tsx` lines 331-463
**Problem:** Hardcoded `generateResponse()` function returns fabricated data
**Impact:** Users receive identical mock responses regardless of actual question

### 2. Limited Backend Intelligence
**Location:** `backend/app/services/llm_service.py`
**Problem:** Template-based SQL with ~20 regex patterns
**Impact:** Questions outside templates get generic fallback queries

### 3. Rigid Response Format
**Location:** `backend/app/schemas/ask.py`
**Problem:** Fixed schema: question, SQL, explanation, rows, visualization_data
**Impact:** Cannot support multiple charts, KPIs, insights simultaneously

### 4. Minimal Insight Generation
**Location:** `backend/app/services/explain_service.py`
**Problem:** Only 3 hardcoded explanation templates
**Impact:** No dynamic financial insights

## Implementation Phases

### Phase 1: Enhanced Response Schema ✅
- [ ] Create flexible response schema supporting multiple output types
- [ ] Add support for KPI cards, insights, warnings, recommendations
- [ ] Enable multiple simultaneous visualizations

### Phase 2: Intelligent Query Understanding Engine ✅
- [ ] Enhance QueryPlanner with comprehensive intent classification
- [ ] Add query decomposition for multi-step questions
- [ ] Implement context-aware follow-up handling
- [ ] Build metric taxonomy and synonym mapping

### Phase 3: Dynamic Text-to-SQL Engine ✅
- [ ] Schema-aware SQL generation with table relationship understanding
- [ ] Enhanced SQLGuard with comprehensive validation
- [ ] Support for complex joins, aggregations, window functions
- [ ] Null handling and date parsing improvements

### Phase 4: Intelligent Output Engine ✅
- [ ] Dynamic visualization selection based on data characteristics
- [ ] Automatic KPI extraction and formatting
- [ ] Financial insight generation
- [ ] Adaptive response formatting (text/table/chart/mixed)

### Phase 5: Frontend Intelligence Layer ✅
- [ ] Remove hardcoded mock responses
- [ ] Implement dynamic chart component selection
- [ ] Add KPI card rendering
- [ ] Enhanced table formatting with financial context

### Phase 6: PDF Extraction Enhancement ✅
- [ ] Audit current extraction accuracy
- [ ] Improve table detection and parsing
- [ ] Better period/date extraction
- [ ] Currency and unit normalization

### Phase 7: Testing & Validation ✅
- [ ] Create comprehensive test suite
- [ ] Regression testing
- [ ] SQL injection and security tests
- [ ] Financial calculation accuracy tests

## Success Criteria

- ✅ Different questions produce appropriately different responses
- ✅ No hardcoded mock data in production paths
- ✅ Dynamic visualization selection
- ✅ Accurate financial calculations
- ✅ Meaningful insights generated
- ✅ SQL safety maintained
- ✅ Context-aware conversations

---

## Files to Modify

### Backend
1. `backend/app/schemas/ask.py` - Enhanced response schema
2. `backend/app/services/query_planner.py` - Intelligent intent classification
3. `backend/app/services/llm_service.py` - Schema-aware SQL generation
4. `backend/app/services/explain_service.py` - Dynamic insight generation
5. `backend/app/services/sql_executor.py` - Enhanced execution with analytics
6. `backend/app/api/v1/endpoints/ask.py` - Updated endpoint logic
7. NEW: `backend/app/services/insight_engine.py` - Financial insight generation
8. NEW: `backend/app/services/visualization_recommender.py` - Smart viz selection

### Frontend
1. `web/src/app/pages/chat.tsx` - Remove mock data, enhance rendering
2. NEW: `web/src/app/components/kpi-card.tsx` - KPI display component
3. NEW: `web/src/app/components/insight-panel.tsx` - Insight display
4. `web/src/app/types/data.ts` - Enhanced type definitions

---

**Next Steps:** Begin Phase 1 implementation
