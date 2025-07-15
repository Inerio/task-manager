package com.inerio.taskmanager.dto;

public class MoveListDto {
    private Long listId;
    private int targetPosition;

    public MoveListDto() {} // Jackson needs a default constructor

    public MoveListDto(Long listId, int targetPosition) {
        this.listId = listId;
        this.targetPosition = targetPosition;
    }

    public Long getListId() { return listId; }
    public void setListId(Long listId) { this.listId = listId; }
    public int getTargetPosition() { return targetPosition; }
    public void setTargetPosition(int targetPosition) { this.targetPosition = targetPosition; }
}