package com.example.fixflow.ai;

import java.util.List;

public interface TechnicianRankingProvider {
    record Candidate(int slot, int proficiency, boolean specialtyMatch, long activeCases) { }
    List<Integer> rank(String category, String specialty, List<Candidate> candidates) throws AIProviderException;
}
