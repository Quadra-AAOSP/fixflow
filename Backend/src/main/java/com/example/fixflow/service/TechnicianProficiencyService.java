package com.example.fixflow.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.ReportRating;
import com.example.fixflow.domain.TechnicianSkill;
import com.example.fixflow.repository.ReportRatingRepository;
import com.example.fixflow.repository.TechnicianSkillRepository;

/**
 * Platform-owned proficiency: starts at 2.5 and is recalculated from reporter
 * ratings every 5 completed (confirmed + rated) jobs in a skill category.
 */
@Service
public class TechnicianProficiencyService {

	public static final int BATCH_SIZE = 5;

	private final ReportRatingRepository ratings;
	private final TechnicianSkillRepository skills;

	public TechnicianProficiencyService(ReportRatingRepository ratings, TechnicianSkillRepository skills) {
		this.ratings = ratings;
		this.skills = skills;
	}

	@Transactional
	public void recalculateAfterRating(ReportRating rating) {
		Long technicianId = rating.getResolution().getTechnician().getId();
		String category = rating.getResolution().getReport().getCategory();
		if (category == null || category.isBlank()) {
			return;
		}
		List<Integer> scores = ratings.findConfirmedReporterScoresForCategory(technicianId, category);
		if (scores.size() < BATCH_SIZE || scores.size() % BATCH_SIZE != 0) {
			return;
		}
		List<Integer> batch = scores.subList(scores.size() - BATCH_SIZE, scores.size());
		double average = batch.stream().mapToInt(Integer::intValue).average().orElse(2.5);
		BigDecimal proficiency = BigDecimal.valueOf(average).setScale(1, RoundingMode.HALF_UP)
				.max(BigDecimal.ONE).min(new BigDecimal("5.0"));
		List<TechnicianSkill> matching = skills.findByTechnician_IdAndCategoryIgnoreCase(technicianId, category);
		for (TechnicianSkill skill : matching) {
			skill.setProficiency(proficiency);
			skills.save(skill);
		}
	}
}
