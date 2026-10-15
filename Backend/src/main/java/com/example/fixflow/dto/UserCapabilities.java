package com.example.fixflow.dto;

import java.util.List;
import com.example.fixflow.domain.UserRole;

/** UI hints only: every endpoint still checks role and resource scope. */
public record UserCapabilities(boolean provision, boolean decideContracts, boolean createSite,
        boolean editSite, boolean assignTechnician, boolean createReport, List<UserRole> provisionableRoles,
        boolean manageShop) {
    public static UserCapabilities forRole(UserRole role) {
        boolean administrator = role == UserRole.admin || role == UserRole.super_admin;
        return new UserCapabilities(administrator, administrator, role == UserRole.super_admin,
                administrator, administrator || role == UserRole.staff,
                role != UserRole.technician && role != UserRole.shop_manager,
                role == UserRole.super_admin ? List.of(UserRole.staff, UserRole.admin, UserRole.shop_manager)
                        : role == UserRole.admin ? List.of(UserRole.staff) : List.of(),
                role == UserRole.super_admin || role == UserRole.shop_manager);
    }
}
