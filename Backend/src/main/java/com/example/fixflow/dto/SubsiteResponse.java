package com.example.fixflow.dto;
import com.example.fixflow.domain.Subsite;
public record SubsiteResponse(Long id, Long siteId, String label, String name, String description) {
    public static SubsiteResponse from(Subsite subsite) { return new SubsiteResponse(subsite.getId(), subsite.getSite().getId(), subsite.getLabel(), subsite.getName(), subsite.getDescription()); }
}
